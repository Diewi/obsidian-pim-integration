using NativeBridge;

namespace NativeBridge.OutlookComBridge.Commands
{
  /// <summary>
  /// Command to export calendar events from Outlook for a given time range.
  /// Returns iCalendar data via the CalendarData protobuf message.
  ///
  /// Requires CalendarExportParams via stdin (CliRequest) to specify the date range.
  /// When context.UseTestData is true, returns test data without Outlook dependency.
  /// </summary>
  public class ExportCalendarCommand : ICliCommand
  {
    public string CommandName => "export-calendar";
    public string Description => "Export calendar events for a time range as iCalendar data.";

    public Task<CliResponse> ExecuteAsync(string[] args, CliExecutionContext context)
    {
      // Extract calendar params from the structured request
      var calendarParams = context.Request?.CalendarExport;

      if (calendarParams == null && !context.UseTestData)
      {
        return Task.FromResult(new CliResponse
        {
          Success = false,
          Command = CommandName,
          Timestamp = DateTimeOffset.UtcNow.Ticks,
          ErrorMessage = "Calendar export requires CalendarExportParams via stdin. " +
                         "Provide a CliRequest with calendar_export params."
        });
      }

      ExportResult exportResult;
      if (context.UseTestData)
      {
        exportResult = TestData.GetTestCalendarExportResult();
      }
      else
      {
        var startDate = new DateTime(calendarParams!.StartDate, DateTimeKind.Utc);
        var endDate = new DateTime(calendarParams.EndDate, DateTimeKind.Utc);
        var includePrivate = calendarParams.IncludePrivate;

        var bridge = new OutlookCalendarBridge();
        exportResult = bridge.ExportCalendarRange(startDate, endDate, includePrivate);
      }

      var response = new CliResponse
      {
        Success = true,
        Command = CommandName,
        Timestamp = DateTimeOffset.UtcNow.Ticks,
        ExportResult = exportResult
      };
      return Task.FromResult(response);
    }
  }
}
