const { 
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder, 
    TextInputStyle,
    ActionRowBuilder
} = require('discord.js');
const noblox = require('noblox.js')

module.exports.data = new SlashCommandBuilder()
	.setName('globan')
	.setDescription('Global bans a user.')
	.addStringOption(option => option.setName('username')
        .setDescription('The username of the account to ban.')
        .setRequired(true)
    )
    .addBooleanOption(opt => opt.setName("crashban")
        .setDescription("Should the person be crashed?")
    )
    .setDMPermission(false)

module.exports.execute = (bot, inter) => {
    if(!inter.member.roles.cache.get('1124555979158204416')) return message.reply(`You do not have permission to global ban.`);
    noblox.getIdFromUsername(inter.options.getString('username')).then((id) => {
        if(id == null) return inter.reply({content: "Invalid userid.", ephemeral: true})
        noblox.getPlayerInfo(id).then((info) => {
            const modal = new ModalBuilder()
            .setCustomId(inter.options.getBoolean('crashban') ? "globalcrashban-" + id : "globalban-" + id)
            .setTitle("Global Ban: @" + info.username)

            const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel("Ban Reason")
            .setMaxLength(100)
            .setRequired(false)
            .setStyle(TextInputStyle.Paragraph)

            const row = new ActionRowBuilder().addComponents(reasonInput)

            modal.addComponents(row)

            inter.showModal(modal)
        })
    })    
}