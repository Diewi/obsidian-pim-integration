using NativeBridge;

namespace NativeBridge.OutlookComBridge.Commands
{
  /// <summary>
  /// Command to export contacts from Outlook as vCard data.
  /// Returns structured contact data with individual vCards.
  ///
  /// When context.UseTestData is true, returns test data instead of actual
  /// Outlook contacts, enabling integration testing without Outlook dependency.
  /// </summary>
  public class ExportContactsCommand : ICliCommand
  {
    public string CommandName => "export-contacts";
    public string Description => "Export all contacts from Outlook as structured data with vCards.";

    public Task<NativeBridge.CliResponse> ExecuteAsync(string[] args, CliExecutionContext context)
    {
      NativeBridge.ExportResult exportResult;
      if (context.UseTestData)
      {
        // Return test data for integration testing
        exportResult = TestData.GetTestExportResult();
      }
      else
      {
        // Export real contacts from Outlook
        try
        {
          var exporter = new OutlookContactBridge();
          exportResult = exporter.ExportContactsForCli();
        }
        catch (Exception ex)
        {
          var errorMessage = $"Failed to export contacts from Outlook: {ex.Message}";
          // The TS executor only reads stderr when the exit code is non-zero.
          Console.Error.WriteLine(errorMessage);
          return Task.FromResult(new NativeBridge.CliResponse
          {
            Success = false,
            Command = CommandName,
            Timestamp = DateTimeOffset.UtcNow.Ticks,
            ErrorMessage = errorMessage,
            ErrorStackTrace = ex.StackTrace ?? ""
          });
        }
      }

      var response = new NativeBridge.CliResponse
      {
        Success = true,
        Command = CommandName,
        Timestamp = DateTimeOffset.UtcNow.Ticks,
        ExportResult = exportResult
      };
      return Task.FromResult(response);
    }
  }

} // namespace NativeBridge.OutlookComBridge.Commands
