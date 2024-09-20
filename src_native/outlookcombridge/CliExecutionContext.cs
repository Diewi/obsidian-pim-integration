namespace NativeBridge.OutlookComBridge
{
  /// <summary>
  /// Execution context passed to CLI commands containing global options and state.
  /// This allows commands to respond to global flags like --test-data without
  /// needing to parse arguments themselves.
  /// </summary>
  public class CliExecutionContext
  {
    /// <summary>
    /// When true, commands should return test data instead of real data.
    /// This enables integration testing across language boundaries.
    /// </summary>
    public bool UseTestData { get; set; }

    /// <summary>
    /// When true, output should be formatted as JSON instead of binary protobuf.
    /// </summary>
    public bool UseJson { get; set; }

    /// <summary>
    /// Creates a default execution context with no special flags enabled.
    /// </summary>
    public static CliExecutionContext Default => new();
  }
}
