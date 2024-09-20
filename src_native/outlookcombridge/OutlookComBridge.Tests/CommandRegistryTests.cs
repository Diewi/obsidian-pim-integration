using NativeBridge.OutlookComBridge;
using NativeBridge.OutlookComBridge.Commands;

namespace OutlookComBridge.Tests
{
  /// <summary>
  /// Tests for the CommandRegistry class.
  /// </summary>
  public class CommandRegistryTests
  {
    private readonly CliExecutionContext _defaultContext = CliExecutionContext.Default;
    [Fact]
    public void Constructor_RegistersDefaultCommands()
    {
      // Arrange & Act
      var registry = new CommandRegistry();
      var allCommands = registry.GetAllCommands().ToList();

      // Assert
      Assert.NotEmpty(allCommands);
      Assert.Contains(allCommands, c => c.CommandName.Equals("ping", StringComparison.OrdinalIgnoreCase));
      Assert.Contains(allCommands, c => c.CommandName.Equals("export-contacts", StringComparison.OrdinalIgnoreCase));
      Assert.Contains(allCommands, c => c.CommandName.Equals("list-commands", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void GetCommand_ReturnsCommand_WhenExists()
    {
      // Arrange
      var registry = new CommandRegistry();

      // Act
      var command = registry.GetCommand("ping");

      // Assert
      Assert.NotNull(command);
      Assert.Equal("ping", command.CommandName, ignoreCase: true);
    }

    [Fact]
    public void GetCommand_ReturnsNull_WhenNotExists()
    {
      // Arrange
      var registry = new CommandRegistry();

      // Act
      var command = registry.GetCommand("nonexistent-command");

      // Assert
      Assert.Null(command);
    }

    [Fact]
    public void GetCommand_IsCaseInsensitive()
    {
      // Arrange
      var registry = new CommandRegistry();

      // Act
      var lowerCase = registry.GetCommand("ping");
      var upperCase = registry.GetCommand("PING");
      var mixedCase = registry.GetCommand("PiNg");

      // Assert
      Assert.NotNull(lowerCase);
      Assert.NotNull(upperCase);
      Assert.NotNull(mixedCase);
      Assert.Equal(lowerCase.CommandName, upperCase.CommandName, ignoreCase: true);
      Assert.Equal(lowerCase.CommandName, mixedCase.CommandName, ignoreCase: true);
    }

    [Fact]
    public async Task ExecuteCommandAsync_ReturnsError_WhenCommandNotFound()
    {
      // Arrange
      var registry = new CommandRegistry();

      // Act
      var response = await registry.ExecuteCommandAsync("unknown-command", Array.Empty<string>(), _defaultContext);

      // Assert
      Assert.False(response.Success);
      Assert.Contains("Unknown command", response.ErrorMessage);
      Assert.Equal("unknown-command", response.Command);
    }

    [Fact]
    public async Task ExecuteCommandAsync_ExecutesCommand_WhenFound()
    {
      // Arrange
      var registry = new CommandRegistry();

      // Act
      var response = await registry.ExecuteCommandAsync("ping", Array.Empty<string>(), _defaultContext);

      // Assert
      Assert.True(response.Success);
      Assert.Equal("ping", response.Command, ignoreCase: true);
      Assert.Equal("pong", response.SimpleResult);
    }

    [Fact]
    public void RegisterCommand_AddsNewCommand()
    {
      // Arrange
      var registry = new CommandRegistry();
      var customCommand = new TestCommand();

      // Act
      registry.RegisterCommand(customCommand);
      var retrieved = registry.GetCommand("test");

      // Assert
      Assert.NotNull(retrieved);
      Assert.Equal("test", retrieved.CommandName, ignoreCase: true);
    }

    [Fact]
    public void RegisterCommand_OverwritesExistingCommand()
    {
      // Arrange
      var registry = new CommandRegistry();
      var firstCommand = new TestCommand { Description = "First" };
      var secondCommand = new TestCommand { Description = "Second" };

      // Act
      registry.RegisterCommand(firstCommand);
      registry.RegisterCommand(secondCommand);
      var retrieved = registry.GetCommand("test");

      // Assert
      Assert.NotNull(retrieved);
      Assert.Equal("Second", retrieved.Description);
    }

    // Test command for registration tests
    private class TestCommand : ICliCommand
    {
      public string CommandName => "test";
      public string Description { get; set; } = "Test command";

      public Task<NativeBridge.CliResponse> ExecuteAsync(string[] args, CliExecutionContext context)
      {
        return Task.FromResult(new NativeBridge.CliResponse
        {
          Success = true,
          Command = CommandName,
          Timestamp = DateTimeOffset.UtcNow.Ticks,
          SimpleResult = "test result"
        });
      }
    }
  }
}
