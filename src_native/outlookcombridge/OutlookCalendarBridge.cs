using Microsoft.Office.Interop.Outlook;
using NativeBridge;

namespace NativeBridge.OutlookComBridge
{
  /// <summary>
  /// Exports calendar events from Outlook as iCalendar data using the
  /// CalendarSharing API, which supports date-range filtering.
  /// </summary>
  public class OutlookCalendarBridge
  {
    /// <summary>
    /// Export calendar events for the specified time range as iCalendar.
    /// Uses Outlook's CalendarSharing.SaveAsICal to produce a standard .ics file
    /// limited to the requested date range.
    /// </summary>
    /// <param name="startDate">Start of the export range (UTC).</param>
    /// <param name="endDate">End of the export range (UTC).</param>
    /// <param name="includePrivate">Whether to include private events.</param>
    /// <returns>ExportResult with CalendarData containing the iCalendar string.</returns>
    public ExportResult ExportCalendarRange(DateTime startDate, DateTime endDate, bool includePrivate)
    {
      try
      {
        var outlookApp = new Application();
        var calendarFolder = outlookApp.Session.GetDefaultFolder(OlDefaultFolders.olFolderCalendar);
        var calSharing = calendarFolder.GetCalendarExporter();

        calSharing.StartDate = startDate;
        calSharing.EndDate = endDate;
        calSharing.CalendarDetail = OlCalendarDetail.olFullDetails;
        calSharing.IncludeAttachments = false;
        calSharing.IncludePrivateDetails = includePrivate;

        var tempFile = Path.Combine(Path.GetTempPath(), $"calendar_{Guid.NewGuid():N}.ics");

        try
        {
          calSharing.SaveAsICal(tempFile);
          var icalContent = File.ReadAllText(tempFile);

          // Count VEVENT occurrences
          var eventCount = CountEvents(icalContent);

          return new ExportResult
          {
            Calendar = new CalendarData
            {
              Ical = icalContent,
              EventCount = eventCount
            }
          };
        }
        finally
        {
          if (File.Exists(tempFile))
          {
            File.Delete(tempFile);
          }
        }
      }
      catch (System.Exception)
      {
        // Return empty result on error — CLI layer will handle errors
        return new ExportResult();
      }
    }

    /// <summary>
    /// Counts the number of VEVENT components in an iCalendar string.
    /// </summary>
    public static int CountEvents(string icalContent)
    {
      int count = 0;
      int index = 0;
      while ((index = icalContent.IndexOf("BEGIN:VEVENT", index, StringComparison.Ordinal)) != -1)
      {
        count++;
        index += "BEGIN:VEVENT".Length;
      }
      return count;
    }
  }
}
