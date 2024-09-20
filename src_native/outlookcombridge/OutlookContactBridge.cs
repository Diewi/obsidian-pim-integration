using System.Text;
using Microsoft.Office.Interop.Outlook;
using NativeBridge;

namespace NativeBridge.OutlookComBridge
{

  public class OutlookContactBridge
  {
    // ========================================================================
    // Core Export Function
    // ========================================================================

    /// <summary>
    /// Core contact export function. Returns individual vCard strings.
    /// Parsing into structured types is handled by typed-vcard on the TS side.
    /// </summary>
    public NativeBridge.ExportResult ExportContactsCore()
    {
      try
      {
        Items outlookItems;
        Application outlookObj;
        MAPIFolder folderContacts;

        outlookObj = new Application();
        folderContacts = outlookObj.Session.GetDefaultFolder(OlDefaultFolders.olFolderContacts);
        outlookItems = folderContacts.Items;

        var vcards = new List<string>();
        var tempFile = Path.Combine(Path.GetTempPath(), "contact.vcf");
        var mergedVCard = new StringBuilder();

        for (int i = 0; i < outlookItems.Count; i++)
        {
          ContactItem outlookContact = (ContactItem)outlookItems[i + 1];

          // Export vCard for this contact
          outlookContact.SaveAs(tempFile, 6);
          var vcard = File.ReadAllText(tempFile, Encoding.UTF8);

          vcards.Add(vcard);
          mergedVCard.Append(vcard);
        }

        if (File.Exists(tempFile))
        {
          File.Delete(tempFile);
        }

        return new ExportResult
        {
          Vcards = new VCardData { Vcards = { vcards } }
        };
      }
      catch (System.Exception)
      {
        // Return empty result on error - CLI layer will handle errors
        return new ExportResult();
      }
    }

    // ========================================================================
    // Interface for edge-js (async Task<object> signature)
    // ========================================================================

    /// <summary>
    /// Edge-js compatible wrapper. Returns merged vCard string for backward compatibility.
    /// </summary>
    public async Task<object> ExportContacts(dynamic input)
    {
      var result = ExportContactsCore();
      if (result.HasMergedVcards)
      {
        return await Task.FromResult<object>(result.MergedVcards ?? "");
      }
      return await Task.FromResult<object>("");
    }

    /// <summary>
    /// Edge-js compatible wrapper. Returns list of individual vCard strings.
    /// </summary>
    public async Task<object> ExportContactsAsList(dynamic input)
    {
      var result = ExportContactsCore();
      if (result.Vcards != null)
      {
        return await Task.FromResult<object>(result.Vcards.Vcards.ToList());
      }
      return await Task.FromResult<object>(new List<string>());
    }

    // ========================================================================
    // Interface for CLI
    // ========================================================================

    /// <summary>
    /// CLI interface. Returns ExportResult directly.
    /// </summary>
    public ExportResult ExportContactsForCli()
    {
      return ExportContactsCore();
    }
  }

} // namespace NativeBridge.OutlookComBridge
