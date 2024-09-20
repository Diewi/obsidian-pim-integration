using NativeBridge;

namespace NativeBridge.OutlookComBridge
{
  /// <summary>
  /// Interface for contact export services.
  /// This abstraction allows for testing without requiring actual Outlook interop.
  /// </summary>
  public interface IContactExportService
  {
    /// <summary>
    /// Export contacts and return the result.
    /// </summary>
    ExportResult ExportContacts();
  }
}
