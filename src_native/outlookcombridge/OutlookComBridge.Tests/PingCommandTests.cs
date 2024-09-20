using NativeBridge.OutlookComBridge;
using NativeBridge.OutlookComBridge.Commands;

namespace OutlookComBridge.Tests
{
  /// <summary>
  /// Tests for the PingCommand class.
  /// </summary>
  public class PingCommandTests
  {
    private readonly CliExecutionContext _defaultContext = CliExecutionContext.Default;
    [Fact]
    public void CommandName_ReturnsPing()
    {
      // Arrange
      var command = new PingCommand();

      // Act
      var name = command.CommandName;

      // Assert
      Assert.Equal("ping", name, ignoreCase: true);
    }

    [Fact]
    public void Description_IsNotEmpty()
    {
      // Arrange
      var command = new PingCommand();

      // Act
      var description = command.Description;

      // Assert
      Assert.False(string.IsNullOrWhiteSpace(description));
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsSuccessResponse()
    {
      // Arrange
      var command = new PingCommand();

      // Act
      var response = await command.ExecuteAsync(Array.Empty<string>(), _defaultContext);

      // Assert
      Assert.True(response.Success);
      Assert.Equal("ping", response.Command, ignoreCase: true);
      Assert.False(string.IsNullOrWhiteSpace(response.SimpleResult));
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsPong()
    {
      // Arrange
      var command = new PingCommand();

      // Act
      var response = await command.ExecuteAsync(Array.Empty<string>(), _defaultContext);

      // Assert
      Assert.Equal("pong", response.SimpleResult);
    }

    [Fact]
    public async Task ExecuteAsync_SetsTimestamp()
    {
      // Arrange
      var command = new PingCommand();
      var beforeExecution = DateTimeOffset.UtcNow.Ticks;

      // Act
      var response = await command.ExecuteAsync(Array.Empty<string>(), _defaultContext);

      // Assert
      var afterExecution = DateTimeOffset.UtcNow.Ticks;
      Assert.InRange(response.Timestamp, beforeExecution, afterExecution);
    }

    [Fact]
    public async Task ExecuteAsync_IgnoresArguments()
    {
      // Arrange
      var command = new PingCommand();
      var args = new[] { "arg1", "arg2", "--flag" };

      // Act
      var response = await command.ExecuteAsync(args, _defaultContext);

      // Assert
      Assert.True(response.Success);
      Assert.Equal("pong", response.SimpleResult);
    }

    [Fact]
    public async Task ExecuteAsync_DoesNotSetErrorMessage()
    {
      // Arrange
      var command = new PingCommand();

      // Act
      var response = await command.ExecuteAsync(Array.Empty<string>(), _defaultContext);

      // Assert
      Assert.True(string.IsNullOrEmpty(response.ErrorMessage));
    }
  }
}
