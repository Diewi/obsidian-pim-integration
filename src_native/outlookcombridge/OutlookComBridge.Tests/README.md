# OutlookComBridge Unit Tests

This project contains unit tests for the OutlookComBridge CLI tool using xUnit and Moq.

## Test Structure

The test suite is organized into several test classes:

### 1. **CommandRegistryTests**
Tests the command registration and dispatch mechanism:
- Registration of default commands (ping, export-contacts, list-commands)
- Command lookup (case-insensitive)
- Command execution
- Custom command registration
- Error handling for unknown commands

### 2. **PingCommandTests**
Tests the basic ping command:
- Command name verification
- Response structure (success, timestamp, simple result)
- "pong" response verification
- Argument handling

### 3. **ListCommandsTests**
Tests the command listing functionality:
- Lists all available commands
- Includes command descriptions
- Correct formatting (one command per line)

### 4. **ExportContactsCommandTests**
Tests contact export functionality:
- Response structure for export command
- Uses mocking for Outlook COM interop testing
- Demonstrates mock-based testing approach for parts that cannot be tested directly

### 5. **ProtobufSerializationTests**
Tests protobuf serialization/deserialization:
- `CliResponse` serialization
- Error messages and stack traces
- `ExportResult` with vCard data
- Length-prefixed protocol (4-byte LE length + payload)
- Empty and multi-item vCard lists

## Running Tests

### Build and Run All Tests
```powershell
cd src_native\outlookcombridge
dotnet test OutlookComBridge.sln
```

### Run Tests with Verbose Output
```powershell
dotnet test OutlookComBridge.Tests\OutlookComBridge.Tests.csproj --logger "console;verbosity=detailed"
```

### Run Specific Test Class
```powershell
dotnet test --filter "FullyQualifiedName~CommandRegistryTests"
```

### Run Single Test
```powershell
dotnet test --filter "FullyQualifiedName~CommandRegistryTests.GetCommand_ReturnsCommand_WhenExists"
```

## Test Framework and Dependencies

- **xUnit 2.6.3** - Modern, extensible unit test framework for .NET
- **Moq 4.20.70** - Mocking framework for creating test doubles
- **Microsoft.NET.Test.Sdk 17.8.0** - SDK for running .NET tests
- **coverlet.collector 6.0.0** - Code coverage collection

## Mocking Strategy for Outlook COM Interop

Since Outlook COM interop (`Microsoft.Office.Interop.Outlook`) cannot be directly tested without an Outlook installation, the tests use:

1. **IContactExportService Interface** - Abstraction layer for contact export
2. **Moq Mocks** - Create test doubles for the service interface
3. **Integration Tests** - Without mocking, tests run against actual Outlook (if available)

### Example Mock Usage

```csharp
var mockService = new Mock<IContactExportService>();
mockService.Setup(s => s.ExportContacts())
    .Returns(new ExportResult
    {
        Vcards = new VCardData { Vcards = { "BEGIN:VCARD\nEND:VCARD" } }
    });
```

## Test Coverage

The test suite covers:
- ✅ Command registration and discovery
- ✅ Command execution and dispatch
- ✅ CLI argument parsing
- ✅ Protobuf serialization/deserialization
- ✅ Length-prefixed binary protocol
- ✅ Error responses
- ✅ Success responses with data
- ⚠️ Outlook COM interop (mocked - real Outlook required for integration tests)

## Project Structure

```
OutlookComBridge.Tests/
├── OutlookComBridge.Tests.csproj    # Test project file
├── README.md                         # This file
├── CommandRegistryTests.cs           # Command registry tests
├── PingCommandTests.cs               # Ping command tests
├── ListCommandsTests.cs              # List commands tests
├── ExportContactsCommandTests.cs     # Export contacts tests (with mocking demo)
└── ProtobufSerializationTests.cs    # Protobuf serialization tests
```

## Notes

- Tests are designed to run without requiring an actual Outlook installation
- The main OutlookComBridge.csproj explicitly excludes test files from compilation
- All tests use the `[Fact]` attribute for simple test methods
- Test methods follow the naming convention: `MethodName_ExpectedBehavior_GivenCondition`
