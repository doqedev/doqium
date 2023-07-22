const { DataTypes, Sequelize } = require("sequelize")
const bcrypt = require('bcrypt')
let saltRounds = 10

const db = new Sequelize({
    host: 'localhost',
    dialect: 'sqlite',
    logging: false,
    storage: 'db.sqlite'
})

const sauthdb = db.define('scriptAuth', {
    openKey: DataTypes.STRING,
    script: DataTypes.TEXT
})

const reqDB = db.define('scriptDBs', {
    requireId: DataTypes.STRING,
    isBannable: DataTypes.BOOLEAN,
    scriptName: DataTypes.TEXT
})

const gbandb = db.define('globalBans', {
    userId: DataTypes.STRING,
    reason: DataTypes.TEXT,
    isCrashBan: DataTypes.BOOLEAN
})

const rauser = db.define('RAUser', {
    username: DataTypes.STRING,
    password: DataTypes.STRING,
    inviteCode: DataTypes.STRING,
    permissions: {
        defaultValue: 0,
        allowNull: false,
        type: DataTypes.NUMBER
    }
})

const invkeys = db.define('inviteKeys', {
    inviteKey: DataTypes.STRING
})

rauser.beforeCreate((user) => {
    const hashedPassword = bcrypt.hashSync(user.password, saltRounds)
    user.password = hashedPassword
})

module.exports.db = db
module.exports.scriptAuthDB = sauthdb
module.exports.globanDB = gbandb
module.exports.UsersDB = rauser
module.exports.InviteKeysDB = invkeys
module.exports.requireDB = reqDB