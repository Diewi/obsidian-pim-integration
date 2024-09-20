using NativeBridge;

namespace NativeBridge.OutlookComBridge.Commands
{
  /// <summary>
  /// Interface for CLI commands that can be dispatched by the CLI tool.
  /// Implement this interface to add new commands without modifying the main CLI entry point.
  /// </summary>
  public interface ICliCommand
  {
    /// <summary>
    /// The command name used to invoke this command from the CLI.
    /// </summary>
    string CommandName { get; }

    /// <summary>
    /// A brief description of what this command does.
    /// </summary>
    string Description { get; }

    /// <summary>
    /// Executes the command with the given arguments and execution context.
    /// </summary>
    /// <param name="args">Command-specific arguments (everything after the command name).</param>
    /// <param name="context">Execution context containing global options like --test-data.</param>
    /// <returns>A CliResponse containing the result or error information.</returns>
    Task<CliResponse> ExecuteAsync(string[] args, CliExecutionContext context);
  }

} // namespace NativeBridge.OutlookComBridge.Commands
