using System.Text.Json;
using NativeBridge;
using NativeBridge.OutlookComBridge.Commands;

namespace NativeBridge.OutlookComBridge
{
  /// <summary>
  /// Flexible CLI tool for OutlookComBridge.
  ///
  /// Usage: OutlookComBridge.exe [global-options] &lt;command&gt; [command-args]
  ///
  /// Global Options:
  ///   --json          Output as JSON instead of binary protobuf (useful for debugging)
  ///   --test-data     Return test data instead of real data (for integration testing)
  ///   --help, -h      Show help information
  ///   --validate-deps Validate that all required DLLs can be loaded
  ///
  /// Commands are dispatched to ICliCommand implementations, making it easy to add
  /// new functionality without modifying this entry point.
  /// </summary>
  public static class CliEntryPoint
  {
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
      WriteIndented = true,
      PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public static async Task<int> Main(string[] args)
    {
      // Parse global options
      var useJson = args.Contains("--json");
      var showHelp = args.Contains("--help") || args.Contains("-h");
      var validateDeps = args.Contains("--validate-deps");
      var useTestData = args.Contains("--test-data");

      // Create execution context with global options
      var context = new CliExecutionContext
      {
        UseJson = useJson,
        UseTestData = useTestData
      };

      // Filter out global options from args
      var filteredArgs = args
          .Where(a => a != "--json" && a != "--help" && a != "-h" && a != "--validate-deps" && a != "--test-data")
          .ToArray();

      // Handle special cases
      if (showHelp)
      {
        ShowHelp();
        return 0;
      }

      if (validateDeps)
      {
        return ValidateDependencies(useJson);
      }

      if (filteredArgs.Length == 0)
      {
        ShowHelp();
        return 0;
      }

      // Read structured request from stdin if input is redirected
      if (Console.IsInputRedirected)
      {
        try
        {
          if (useJson)
          {
            // JSON input mode
            var jsonInput = await Console.In.ReadToEndAsync();
            if (!string.IsNullOrWhiteSpace(jsonInput))
            {
              var parser = new Google.Protobuf.JsonParser(Google.Protobuf.JsonParser.Settings.Default);
              context.Request = parser.Parse<NativeBridge.CliRequest>(jsonInput);
            }
          }
          else
          {
            // Binary protobuf input mode
            using var stdin = Console.OpenStandardInput();
            using var ms = new MemoryStream();
            await stdin.CopyToAsync(ms);
            if (ms.Length > 0)
            {
              ms.Position = 0;
              context.Request = NativeBridge.CliRequest.Parser.ParseFrom(ms);
            }
          }
        }
        catch (Exception ex)
        {
          var errorResponse = new NativeBridge.CliResponse
          {
            Success = false,
            Command = filteredArgs.Length > 0 ? filteredArgs[0] : "unknown",
            Timestamp = DateTimeOffset.UtcNow.Ticks,
            ErrorMessage = $"Failed to parse stdin request: {ex.Message}",
            ErrorStackTrace = ex.StackTrace ?? ""
          };
          OutputResponse(errorResponse, useJson);
          return 1;
        }
      }

      // Extract command name and remaining args
      var commandName = filteredArgs[0];
      var commandArgs = filteredArgs.Skip(1).ToArray();

      // Execute command with context
      var registry = new CommandRegistry();
      var response = await registry.ExecuteCommandAsync(commandName, commandArgs, context);

      // Output response
      OutputResponse(response, useJson);

      return response.Success ? 0 : 1;
    }

    private static void ShowHelp()
    {
      Console.WriteLine(@"
OutlookComBridge CLI - Flexible command dispatcher for Outlook integration

Usage: OutlookComBridge.exe [global-options] <command> [command-args]

Global Options:
  --json          Output as JSON instead of binary protobuf (useful for debugging).
                  Also switches stdin parsing to JSON mode.
  --test-data     Return test data instead of real data (for integration testing)
  --help, -h      Show this help information
  --validate-deps Validate that all required DLLs can be loaded

Stdin Input:
  Commands can receive structured parameters via stdin as protobuf (default)
  or JSON (with --json flag). The message format is CliRequest as defined in
  native_bridge.proto.

Available Commands:
  export-contacts   Export all contacts from Outlook as structured vCard data
  export-calendar   Export calendar events for a time range as iCalendar data
  ping              Test command to verify CLI tool works correctly
  list-commands     List all available CLI commands

Examples:
  OutlookComBridge.exe export-contacts              # Binary protobuf output
  OutlookComBridge.exe export-contacts --json       # JSON output for debugging
  OutlookComBridge.exe --test-data export-contacts  # Test data for integration testing
  OutlookComBridge.exe --test-data --json export-contacts  # Test data as JSON
  OutlookComBridge.exe ping --json                  # Quick connectivity test
  OutlookComBridge.exe --validate-deps              # Check DLL loading
  echo <json> | OutlookComBridge.exe --json export-calendar  # Calendar export with params via stdin

Output Format:
  By default, output is length-prefixed binary protobuf:
    [4 bytes: little-endian uint32 length][N bytes: protobuf payload]

  With --json flag, output is generated as human-readable JSON to stdout.
");
    }

    private static int ValidateDependencies(bool useJson)
    {
      var response = new CliResponse
      {
        Success = true,
        Command = "validate-deps",
        Timestamp = DateTimeOffset.UtcNow.Ticks
      };
      var errors = new List<string>();

      // Step 1: Validate required configuration files
      Console.Error.WriteLine("\n=== Checking Configuration Files ===");
      var exePath = System.Reflection.Assembly.GetExecutingAssembly().Location;
      var exeDir = Path.GetDirectoryName(exePath) ?? ".";
      var baseName = Path.GetFileNameWithoutExtension(exePath);

      var configFiles = new Dictionary<string, string>
            {
                { "deps.json", Path.Combine(exeDir, $"{baseName}.deps.json") },
                { "runtimeconfig.json", Path.Combine(exeDir, $"{baseName}.runtimeconfig.json") }
            };

      foreach (var (name, path) in configFiles)
      {
        if (File.Exists(path))
        {
          Console.Error.WriteLine($"[OK] {name} found: {path}");
        }
        else
        {
          errors.Add($"Missing {name}: {path}");
          Console.Error.WriteLine($"[ERROR] Missing {name}: {path}");
        }
      }

      // Step 2: Validate required DLL assemblies
      Console.Error.WriteLine("\n=== Checking Required Assemblies ===");

      // Get dependencies from deps.json if available
      var expectedDependencies = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
      var depsJsonPath = configFiles.ContainsKey("deps.json") ? configFiles["deps.json"] : null;

      if (depsJsonPath != null && File.Exists(depsJsonPath))
      {
        try
        {
          var depsContent = File.ReadAllText(depsJsonPath);
          var depsDoc = JsonDocument.Parse(depsContent);

          if (depsDoc.RootElement.TryGetProperty("libraries", out var libraries))
          {
            foreach (var library in libraries.EnumerateObject())
            {
              var libraryName = library.Name.Split('/')[0]; // Remove version suffix
              expectedDependencies.Add(libraryName);
            }
            Console.Error.WriteLine($"[INFO] Found {expectedDependencies.Count} dependencies in deps.json");
          }
        }
        catch (Exception ex)
        {
          Console.Error.WriteLine($"[WARNING] Could not parse deps.json: {ex.Message}");
        }
      }

      // Get currently loaded assemblies via reflection
      var loadedAssemblies = AppDomain.CurrentDomain.GetAssemblies()
          .Where(a => !a.IsDynamic && !string.IsNullOrEmpty(a.Location))
          .ToList();

      Console.Error.WriteLine($"[INFO] Currently loaded assemblies: {loadedAssemblies.Count}");

      // Validate all dependencies from deps.json
      if (expectedDependencies.Count > 0)
      {
        Console.Error.WriteLine($"\n--- Validating Dependencies from deps.json ---");

        foreach (var depName in expectedDependencies.OrderBy(d => d))
        {
          // Skip system/runtime libraries that are always available
          if (depName.StartsWith("System.", StringComparison.OrdinalIgnoreCase) ||
              depName.StartsWith("Microsoft.NETCore.", StringComparison.OrdinalIgnoreCase) ||
              depName.StartsWith("runtime.", StringComparison.OrdinalIgnoreCase))
          {
            continue;
          }

          var loaded = loadedAssemblies.FirstOrDefault(a =>
              a.GetName().Name?.Equals(depName, StringComparison.OrdinalIgnoreCase) == true);

          if (loaded != null)
          {
            Console.Error.WriteLine($"[OK] {depName}: {loaded.GetName().Version}");
          }
          else
          {
            // Try to load the assembly to verify it's available
            try
            {
              var assembly = System.Reflection.Assembly.Load(depName);
              Console.Error.WriteLine($"[OK] {depName}: {assembly.GetName().Version} (loaded on-demand)");
            }
            catch (Exception ex)
            {
              errors.Add($"{depName}: Cannot load - {ex.Message}");
              Console.Error.WriteLine($"[ERROR] {depName}: Cannot load - {ex.Message}");
            }
          }
        }
      }

      // Show summary of all loaded assemblies
      Console.Error.WriteLine($"\n--- All Loaded Assemblies ({loadedAssemblies.Count}) ---");
      foreach (var assembly in loadedAssemblies.OrderBy(a => a.GetName().Name))
      {
        var name = assembly.GetName();
        Console.Error.WriteLine($"  • {name.Name} ({name.Version})");
      }

      // Prepare final response
      Console.Error.WriteLine("\n=== Validation Summary ===");
      if (errors.Count > 0)
      {
        Console.Error.WriteLine($"[FAILED] {errors.Count} error(s) found");
        response = new CliResponse
        {
          Success = false,
          Command = "validate-deps",
          Timestamp = DateTimeOffset.UtcNow.Ticks,
          ErrorMessage = string.Join("; ", errors)
        };
      }
      else
      {
        Console.Error.WriteLine($"[SUCCESS] All dependencies validated successfully");
        response.SimpleResult = "All dependencies validated successfully.";
      }

      OutputResponse(response, useJson);
      return response.Success ? 0 : 1;
    }

    private static void OutputResponse(NativeBridge.CliResponse response, bool useJson)
    {
      if (useJson)
      {
        // Use protobuf's JsonFormatter for proper serialization of protobuf messages
        var formatter = new Google.Protobuf.JsonFormatter(
            new Google.Protobuf.JsonFormatter.Settings(true) // formatDefaultValues: true
        );
        var json = formatter.Format(response);
        Console.WriteLine(json);
      }
      else
      {
        // Write length-prefixed binary protobuf to stdout
        using var ms = new MemoryStream();
        using (var output = new Google.Protobuf.CodedOutputStream(ms, true))
        {
          response.WriteTo(output);
        }
        var bytes = ms.ToArray();

        using var stdout = Console.OpenStandardOutput();
        var lengthBytes = BitConverter.GetBytes((uint)bytes.Length);
        if (!BitConverter.IsLittleEndian)
        {
          Array.Reverse(lengthBytes);
        }
        stdout.Write(lengthBytes, 0, 4);
        stdout.Write(bytes, 0, bytes.Length);
        stdout.Flush();
      }
    }
  }

} // namespace NativeBridge.OutlookComBridge
