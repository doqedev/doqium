local PlayerScrolling = script.Parent
local PlayerFrame = script.PlayerFrame
local ThumbnailType = Enum.ThumbnailType.HeadShot
local ThumbnailSize = Enum.ThumbnailSize.Size420x420

wait(3)

function playerAdded(plr: Player)
	local UserID = plr.UserId

	local ImageContent = plr:GetUserThumbnailAsync(UserID, ThumbnailType, ThumbnailSize)

	print(ImageContent)
end

game.Players.PlayerAdded:Connect(playerAdded)

for _, Player in ipairs(game:GetService("Players"):GetPlayers()) do
	playerAdded(Player)
end
