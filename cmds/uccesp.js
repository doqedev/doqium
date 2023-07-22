const { 
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder, 
    TextInputStyle,
    ActionRowBuilder
} = require('discord.js');
const noblox = require('noblox.js')

function convertToLuauString(str) {
  let luauString = "";
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const charCode = char.charCodeAt(0);
    luauString += "\\" + charCode.toString();
  }
  return luauString;
}

function reverseString(str) {
    var splitString = str.split("");
    var reverseArray = splitString.reverse();
    var joinArray = reverseArray.join("");

    return joinArray;
}

function xorEncode(inputString, key) {
  let encodedString = '';
  
  for (let i = 0; i < inputString.length; i++) {
    const charCode = inputString.charCodeAt(i);
    const encodedChar = String.fromCharCode(charCode ^ (key || 42)); // XOR operation
    
    encodedString += encodedChar;
  }
  
  return encodedString;
}

module.exports.data = new SlashCommandBuilder()
	.setName('uniesc')
	.setDescription('Escapes unicode.')
    .addStringOption(opt => opt.setName("string")
        .setDescription("The string to convert to.")
        .setRequired(true)
    )
    .setDMPermission(false)

module.exports.execute = (bot, inter) => {
    inter.reply({ephemeral: true, content: `\`\`${convertToLuauString(inter.options.getString('string'))}\`\`\n\n\`\`${convertToLuauString(xorEncode(reverseString(Buffer.from(inter.options.getString('string'), 'utf8').toString('base64'))))}\`\``})
}