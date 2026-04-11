using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Office.Interop.Outlook;
using NativeBridge;

namespace NativeBridge.OutlookComBridge
{

  public class OutlookContactBridge
  {
    /// <summary>
    /// Reads a vCard file exported by Outlook with correct encoding detection.
    /// Outlook vCard 2.1 files use the system's ANSI code page (typically Windows-1252),
    /// not UTF-8. Reading with UTF-8 corrupts non-ASCII characters like umlauts.
    /// </summary>
    private static string ReadVCardFile(string path)
    {
      var bytes = File.ReadAllBytes(path);

      // UTF-8 BOM: use UTF-8
      if (bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF)
      {
        return Encoding.UTF8.GetString(bytes, 3, bytes.Length - 3);
      }

      // Try strict UTF-8 first (throws on invalid sequences)
      try
      {
        var utf8Strict = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);
        return utf8Strict.GetString(bytes);
      }
      catch (DecoderFallbackException)
      {
        // Not valid UTF-8 — fall back to Windows-1252 (Outlook's typical encoding)
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        return Encoding.GetEncoding(1252).GetString(bytes);
      }
    }

    /// <summary>
    /// Normalizes a vCard string that was decoded from a legacy charset (e.g. Windows-1252)
    /// so it is valid UTF-8 throughout. This involves:
    /// 1. Normalizing line endings to CRLF (RFC 6350).
    /// 2. Decoding QUOTED-PRINTABLE property values using the declared CHARSET.
    /// 3. Rewriting CHARSET parameters to UTF-8 and removing ENCODING=QUOTED-PRINTABLE
    ///    for properties that have been decoded.
    /// </summary>
    private static string NormalizeVCard(string vcard)
    {
      // Normalize line endings to CRLF
      vcard = vcard.Replace("\r\n", "\n").Replace("\r", "\n").Replace("\n", "\r\n");

      // Decode QUOTED-PRINTABLE properties and rewrite CHARSET to UTF-8.
      // QP continuation lines (ending with =\r\n) are unfolded first.
      vcard = Regex.Replace(vcard,
        @"^((?<propname>[^\r\n:;]+?)(?<params>;[^\r\n:]*?;ENCODING=QUOTED-PRINTABLE[^\r\n:]*?):)(?<value>[\s\S]*?)(?=\r\n[^\s=]|\r\n\r\n|\z)",
        match => DecodeQuotedPrintableProperty(match),
        RegexOptions.Multiline | RegexOptions.IgnoreCase);

      return vcard;
    }

    /// <summary>
    /// Decodes a single QUOTED-PRINTABLE vCard property, handling charset conversion
    /// and removing the ENCODING parameter from the result.
    /// </summary>
    private static string DecodeQuotedPrintableProperty(Match match)
    {
      var propName = match.Groups["propname"].Value;
      var paramsStr = match.Groups["params"].Value;
      var qpValue = match.Groups["value"].Value;

      // Extract charset from parameters (default to Windows-1252 for Outlook vCards)
      var charsetMatch = Regex.Match(paramsStr, @"CHARSET=([^\s;:]+)", RegexOptions.IgnoreCase);
      var charsetName = charsetMatch.Success ? charsetMatch.Groups[1].Value : "Windows-1252";

      Encoding sourceEncoding;
      try
      {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        sourceEncoding = Encoding.GetEncoding(charsetName);
      }
      catch
      {
        sourceEncoding = Encoding.GetEncoding(1252);
      }

      // Unfold QP continuation lines (soft line breaks: =\r\n)
      var unfolded = qpValue.Replace("=\r\n", "");

      // Decode QP: =XX hex pairs → bytes → string via source charset
      var decodedBytes = new List<byte>();
      for (int i = 0; i < unfolded.Length; i++)
      {
        if (unfolded[i] == '=' && i + 2 < unfolded.Length
            && IsHexChar(unfolded[i + 1]) && IsHexChar(unfolded[i + 2]))
        {
          decodedBytes.Add(Convert.ToByte(unfolded.Substring(i + 1, 2), 16));
          i += 2;
        }
        else
        {
          // Plain ASCII character — add its byte directly
          foreach (var b in sourceEncoding.GetBytes(new[] { unfolded[i] }))
            decodedBytes.Add(b);
        }
      }
      var decodedValue = sourceEncoding.GetString(decodedBytes.ToArray());

      // Remove ENCODING=QUOTED-PRINTABLE and CHARSET=xxx from parameters
      var newParams = Regex.Replace(paramsStr, @";ENCODING=QUOTED-PRINTABLE", "", RegexOptions.IgnoreCase);
      newParams = Regex.Replace(newParams, @";CHARSET=[^\s;:]+", "", RegexOptions.IgnoreCase);

      return $"{propName}{newParams}:{decodedValue}";
    }

    private static bool IsHexChar(char c)
    {
      return (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F') || (c >= 'a' && c <= 'f');
    }

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
          var vcard = NormalizeVCard(ReadVCardFile(tempFile));

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
