using NativeBridge;

namespace NativeBridge.OutlookComBridge.Commands
{
  /// <summary>
  /// Registry that discovers and dispatches CLI commands.
  /// New commands are automatically discovered if they implement ICliCommand.
  /// </summary>
  public class CommandRegistry
  {
    private readonly Dictionary<string, ICliCommand> _commands = new(StringComparer.OrdinalIgnoreCase);

    public CommandRegistry()
    {
      // Register all known commands
      RegisterCommand(new ExportContactsCommand());
      RegisterCommand(new ExportCalendarCommand());
      RegisterCommand(new PingCommand());
      RegisterCommand(new TestEchoCommand());
      RegisterCommand(new ListCommandsCommand(this));
    }

    public void RegisterCommand(ICliCommand command)
    {
      _commands[command.CommandName] = command;
    }

    public ICliCommand? GetCommand(string commandName)
    {
      return _commands.TryGetValue(commandName, out var command) ? command : null;
    }

    public IEnumerable<ICliCommand> GetAllCommands() => _commands.Values;

    public async Task<CliResponse> ExecuteCommandAsync(string commandName, string[] args, CliExecutionContext context)
    {
      var command = GetCommand(commandName);
      if (command == null)
      {
        return new CliResponse
        {
          Success = false,
          Command = commandName,
          Timestamp = DateTimeOffset.UtcNow.Ticks,
          ErrorMessage = $"Unknown command: '{commandName}'. Use 'list-commands' to see available commands."
        };
      }
      return await command.ExecuteAsync(args, context);
    }
  }

  /// <summary>
  /// Simple ping command for testing connectivity and DLL loading.
  /// </summary>
  public class PingCommand : ICliCommand
  {
    public string CommandName => "ping";
    public string Description => "Test command to verify CLI tool and DLL loading works correctly.";

    public Task<CliResponse> ExecuteAsync(string[] args, CliExecutionContext context)
    {
      var response = new CliResponse
      {
        Success = true,
        Command = CommandName,
        Timestamp = DateTimeOffset.UtcNow.Ticks,
        SimpleResult = "pong"
      };
      return Task.FromResult(response);
    }
  }

  /// <summary>
  /// Echo command for testing protobuf encoding/decoding.
  /// Returns a test message in the echo field of ExportResult.
  /// </summary>
  public class TestEchoCommand : ICliCommand
  {
    public string CommandName => "test-echo";
    public string Description => "Returns a test echo message for protobuf encoding validation.";

    public Task<CliResponse> ExecuteAsync(string[] args, CliExecutionContext context)
    {
      var message = context.UseTestData
          ? "Hello from test data!"
          : "Hello World from OutlookComBridge!";

      var response = new CliResponse
      {
        Success = true,
        Command = CommandName,
        Timestamp = DateTimeOffset.UtcNow.Ticks,
        ExportResult = new ExportResult
        {
          Echo = message
        }
      };
      return Task.FromResult(response);
    }
  }

  /// <summary>
  /// Lists all available commands.
  /// </summary>
  public class ListCommandsCommand : ICliCommand
  {
    private readonly CommandRegistry _registry;

    public ListCommandsCommand(CommandRegistry registry)
    {
      _registry = registry;
    }

    public string CommandName => "list-commands";
    public string Description => "List all available CLI commands.";

    public Task<CliResponse> ExecuteAsync(string[] args, CliExecutionContext context)
    {
      var commands = _registry.GetAllCommands()
          .Select(c => $"{c.CommandName}: {c.Description}")
          .ToList();

      var response = new CliResponse
      {
        Success = true,
        Command = CommandName,
        Timestamp = DateTimeOffset.UtcNow.Ticks,
        SimpleResult = string.Join("\n", commands)
      };
      return Task.FromResult(response);
    }
  }

} // namespace NativeBridge.OutlookComBridge.Commands
