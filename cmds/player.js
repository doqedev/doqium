const { 
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder, 
    TextInputStyle,
    ActionRowBuilder
} = require('discord.js');
const noblox = require('noblox.js')

module.exports.data = new SlashCommandBuilder()
	.setName('player')
	.setDescription('Library for the players!')
	.addSubcommand(cmd => cmd.setName('create')
        .setDescription("Creates a player in the specified server.")
        .addStringOption(opt => opt.setName('name')
            .setDescription('The name of the player to create.')
        )
    )
    .setDMPermission(false)

module.exports.execute = (bot, inter) => {
    
}