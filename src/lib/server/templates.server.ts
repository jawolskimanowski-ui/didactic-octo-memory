export const STARTER_SOURCE = `-- loadstring.lua · private source
-- Only the project owner can read this file on the website.
-- Publishing serves this payload at /raw/<slug>.

local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local gui = Instance.new("ScreenGui")
gui.Name = "LoadstringWelcome"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.Parent = playerGui

local frame = Instance.new("Frame")
frame.Name = "Card"
frame.AnchorPoint = Vector2.new(0.5, 0)
frame.Position = UDim2.new(0.5, 0, 0, 20)
frame.Size = UDim2.fromOffset(320, 88)
frame.BackgroundColor3 = Color3.fromRGB(12, 14, 18)
frame.BorderSizePixel = 0
frame.Parent = gui

local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 12)
corner.Parent = frame

local stroke = Instance.new("UIStroke")
stroke.Color = Color3.fromRGB(40, 42, 48)
stroke.Thickness = 1
stroke.Parent = frame

local title = Instance.new("TextLabel")
title.BackgroundTransparency = 1
title.Position = UDim2.fromOffset(16, 16)
title.Size = UDim2.new(1, -32, 0, 24)
title.Font = Enum.Font.GothamBold
title.TextSize = 16
title.TextXAlignment = Enum.TextXAlignment.Left
title.TextColor3 = Color3.fromRGB(244, 244, 245)
title.Text = "loadstring.lua"
title.Parent = frame

local subtitle = Instance.new("TextLabel")
subtitle.BackgroundTransparency = 1
subtitle.Position = UDim2.fromOffset(16, 44)
subtitle.Size = UDim2.new(1, -32, 0, 22)
subtitle.Font = Enum.Font.Gotham
subtitle.TextSize = 13
subtitle.TextXAlignment = Enum.TextXAlignment.Left
subtitle.TextColor3 = Color3.fromRGB(161, 161, 170)
subtitle.Text = "Private script online"
subtitle.Parent = frame

task.delay(4, function()
	local tween = TweenService:Create(
		frame,
		TweenInfo.new(0.35, Enum.EasingStyle.Quad, Enum.EasingDirection.In),
		{ Position = UDim2.new(0.5, 0, 0, -120) }
	)
	tween:Play()
	tween.Completed:Wait()
	gui:Destroy()
end)
`;

export const JOIN_NOTIFIER_SOURCE = `-- loadstring.lua · JoinNotifier
-- Fires a remote-safe local announcement when a player joins.

local Players = game:GetService("Players")
local StarterGui = game:GetService("StarterGui")

local function announce(player)
	pcall(function()
		StarterGui:SetCore("ChatMakeSystemMessage", {
			Text = string.format("[loadstring] %s joined the experience", player.DisplayName);
			Color = Color3.fromRGB(200, 204, 212);
		})
	end)
end

Players.PlayerAdded:Connect(announce)

for _, player in ipairs(Players:GetPlayers()) do
	task.spawn(announce, player)
end
`;

export const INVENTORY_BRIDGE_SOURCE = `-- loadstring.lua · InventoryBridge (draft)
-- Bindable bridge for keeping inventory state in one module.

local HttpService = game:GetService("HttpService")

local InventoryBridge = {}
InventoryBridge.__index = InventoryBridge

function InventoryBridge.new()
	local self = setmetatable({
		_items = {},
		Changed = Instance.new("BindableEvent"),
	}, InventoryBridge)
	return self
end

function InventoryBridge:Add(itemId, amount)
	assert(typeof(itemId) == "string", "itemId must be a string")
	amount = math.max(1, tonumber(amount) or 1)
	self._items[itemId] = (self._items[itemId] or 0) + amount
	self.Changed:Fire(itemId, self._items[itemId])
end

function InventoryBridge:Count(itemId)
	return self._items[itemId] or 0
end

function InventoryBridge:Serialize()
	return HttpService:JSONEncode(self._items)
end

return InventoryBridge
`;

export const TEMPLATES = [
  {
    id: "welcome",
    name: "Welcome HUD",
    description: "A private ScreenGui toast that confirms the hosted script ran.",
    source: STARTER_SOURCE,
  },
  {
    id: "join",
    name: "Join notifier",
    description: "Announce players locally when they enter the experience.",
    source: JOIN_NOTIFIER_SOURCE,
  },
  {
    id: "inventory",
    name: "Inventory bridge",
    description: "A small Luau module for inventory state with a Changed event.",
    source: INVENTORY_BRIDGE_SOURCE,
  },
] as const;

export function templateById(id: string): string {
  const found = TEMPLATES.find((t) => t.id === id);
  return found ? found.source : STARTER_SOURCE;
}

export const PUBLIC_TEMPLATES = TEMPLATES.map(({ id, name, description }) => ({
  id,
  name,
  description,
}));
