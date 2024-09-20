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
        var exporter = new OutlookContactBridge();
        exportResult = exporter.ExportContactsForCli();
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
