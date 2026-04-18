using Microsoft.Office.Interop.Outlook;
using System.Linq;
using System.Runtime.InteropServices;
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
    /// <param name="calendarFolder">Optional calendar folder name. Empty or null uses the default calendar.</param>
    /// <returns>ExportResult with CalendarData containing the iCalendar string.</returns>
    public ExportResult ExportCalendarRange(DateTime startDate, DateTime endDate, bool includePrivate, string? calendarFolder = null)
    {
      Application? outlookApp = null;
      MAPIFolder? folder = null;
      CalendarSharing? calSharing = null;
      try
      {
        outlookApp = new Application();
        if (!string.IsNullOrEmpty(calendarFolder))
        {
          folder = FindCalendarFolder(outlookApp, calendarFolder);
        }
        else
        {
          folder = outlookApp.Session.GetDefaultFolder(OlDefaultFolders.olFolderCalendar);
        }
        calSharing = folder.GetCalendarExporter();

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
      finally
      {
        if (calSharing != null) Marshal.ReleaseComObject(calSharing);
        if (folder != null) Marshal.ReleaseComObject(folder);
        if (outlookApp != null) Marshal.ReleaseComObject(outlookApp);
      }
    }

    /// <summary>
    /// Find a calendar folder by name within the default calendar folder's subfolders.
    /// Searches direct subfolders of the default calendar folder.
    /// </summary>
    /// <param name="outlookApp">Outlook application instance.</param>
    /// <param name="folderName">Name of the calendar folder to find.</param>
    /// <returns>The matching MAPIFolder.</returns>
    /// <exception cref="System.Exception">Thrown if the folder is not found.</exception>
    private static MAPIFolder FindCalendarFolder(Application outlookApp, string folderName)
    {
      var defaultCalendar = outlookApp.Session.GetDefaultFolder(OlDefaultFolders.olFolderCalendar);
      foreach (MAPIFolder subfolder in defaultCalendar.Folders)
      {
        if (string.Equals(subfolder.Name, folderName, StringComparison.OrdinalIgnoreCase))
        {
          return subfolder;
        }
      }
      throw new System.Exception($"Calendar folder '{folderName}' not found. " +
        "Available folders: " + string.Join(", ",
          defaultCalendar.Folders.Cast<MAPIFolder>().Select(f => f.Name)));
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
