require('dotenv').config()

const Discord = require('discord.js')
const {IntentsBitField, 
    Events, 
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    AttachmentBuilder,
    REST,
    Routes,
    Collection,
    PermissionsBitField
} = Discord
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt')
const flash = require('connect-flash')
const rs = require('random-string')
const cookieParser = require('cookie-parser')

const crypto = require('./crypto')
const bot = new Discord.Client({intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.MessageContent, IntentsBitField.Flags.GuildMessages]})
bot.cmds = new Collection();

const noblox = require('noblox.js')
const axios = require('axios').default

const Sequelize = require('sequelize')
const {DataTypes} = require('sequelize')
const { v4: uuidv4 } = require('uuid');
const express = require('express')

const events = require('./globalEvents')

const knownRequires = require('./knownRequires.json')

const app = express()

let scripts = []
let scriptid = uuidv4()
let notShutDown = true
let afterchannel = []

const {scriptAuthDB, globanDB, db, UsersDB, InviteKeysDB, requireDB} = require('./database')

const {EventEmitter} = require('events')

const servers = []
const serverResponseCallback = new EventEmitter()

function serverPromise(serverId, ...args){
    const table = [...args]
    const reqKey = uuidv4()

    return new Promise((res, rej) => {
        const server = servers.find(srv => srv.serverKey == serverId)
        if(!server) rej("Invalid server.")

        server.promises.push({
            requestKey: reqKey,
            args: table
        })

        const onData = (requestKey, data) => {
            if(requestKey == reqKey){
                res(data)
            }
        }
        
        const listenerWrapper = (rkey, data) => {
            onData(rkey, data)
            serverResponseCallback.removeListener('data', listenerWrapper)
        }

        serverResponseCallback.on('data', listenerWrapper)
    })
}


function downloadAsset(assetId, savePath) {
    return new Promise(async (res, rej) => {
        try {
            const response = await axios.get(`https://assetdelivery.roblox.com/v1/asset/?id=${assetId}`, { responseType: 'arraybuffer' });
            fs.writeFileSync(savePath, response.data);
            res()
        } catch(e) {
            rej(e)
        }
    })
}

function doesAssetExist(assetId) {
    return new Promise(async (res, rej) => {
        axios.get(`https://roblox.com/library/${assetId}`).then(() => {
            res(true)
        }).catch(() => {
            res(false)
        })
    })
}

const fs = require('fs');
const path = require('path')
const jimp = require('jimp')

function filter(inputString, replacement) {
  const jsonData = fs.readFileSync('blacklist.json', 'utf8');

  const keywords = JSON.parse(jsonData);

  const blacklistedKeywords = keywords.requires;

  blacklistedKeywords.forEach((keyword) => {
    const regex = new RegExp(keyword, 'gi');

    inputString = inputString.replace(regex, replacement || 'REDACTED');
  });

  return inputString;
}

function getVersions() {
  const jsonData = fs.readFileSync('versions.json', 'utf8');

  return JSON.parse(jsonData);
}

function getKnownRequiresFromText(inputString) {
  return new Promise(async (res, rej) => {
    const jsonData = await requireDB.findAll();

    const knownRequires = jsonData.map((data) => data.requireId);

    const matchedValues = [];

    const regexPattern = /require\((\d+)\)/g;

    let match;
    while ((match = regexPattern.exec(inputString)) !== null) {
      const number = match[1];

      if (knownRequires.includes(number.toString())) {
        const scriptData = await requireDB.findOne({ where: { requireId: number.toString() } });
        matchedValues.push(scriptData.scriptName);
      }
    }

    res(matchedValues);
  });
}

function globalAnnouncement(message){
    servers.forEach((server) => {
        server.announcements.push(message)
    })
}

const session = require('express-session')
const SequelizeSessionStore = require('connect-session-sequelize')(session.Store)

app.set('views', __dirname + "/views")
app.set('view engine', 'ejs')

app.use(express.json())
app.use(express.urlencoded({extended: true}))

const sesStore = new SequelizeSessionStore({
    db: db,
    expiration: 3600000 * 24,
    checkExpirationInterval: 15 * 60 * 1000
})

sesStore.sync()

app.use(session({
  secret: process.env.sessionSecret, // Replace with your actual secret key
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 3600000 * 24
  },
  store: sesStore
}));
app.use(flash())

app.use(passport.initialize())
app.use(passport.session())
app.use(express.static('public'));
app.use(cookieParser())

passport.use(new LocalStrategy(
  { usernameField: 'username' },
  async (username, password, done) => {
    try {
      const user = await UsersDB.findOne({ where: { username: username } });

      if (user) {
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (passwordMatch) {
          return done(null, user);
        } else {
          return done(null, false, { message: 'Incorrect username or password.' });
        }
      } else {
        return done(null, false, { message: 'Incorrect username or password.' });
      }
    } catch (err) {
      return done(err);
    }
  }
));

// Serialize and deserialize user
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await UsersDB.findByPk(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});


function isAuthenticated(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }
    req.flash('error', 'Please log in to access this page.')
    res.redirect('/login')
}

function isAuthenticatedReverse(req, res, next){
    if(req.isAuthenticated()) return res.redirect('/home');
    next()
}

app.get('/', isAuthenticated, (req, res) => {
    res.redirect('/home')
})

app.post('/login', passport.authenticate('local', {
  successRedirect: '/home',
  failureRedirect: '/login',
  failureFlash: true,
}), (req, res) => {

  // Redirect to the dashboard or any other logged-in page
  res.redirect('/home', {user: req.user});
});

app.get('/globalban', isAuthenticated, (req, res) => {
    if(req.user.permissions < 2) {
        req.flash('error', 'You do not have permission to view this page.')
        res.redirect('/home')
        return;
    }
    const msg = req.flash('msg')[0] || null
    res.render('globalban', { message: msg, user: req.user})
});

app.get('/editor', (req, res) =>{
    res.render('editor')
})

app.get('/rf', (req, res) => {
    res.render('flagRequire', {user: req.user})
})

function getPermissionFromMember(member){
    if(!member) return 0;
    if(!member.roles) return 0;
    if(!member.roles.cache) return 0;
    if(member.roles.cache.get('1124555979158204416')) return 4;
    if(member.roles.cache.get('1126328592729649224')) return 4;
    if(member.roles.cache.get('1124554507280453682')) return 4;
    if(member.roles.cache.get('1124556127288446976')) return 4;
    if(member.roles.cache.get('1126703715248767036')) return 3;
    if(member.roles.cache.get('1126703677336473671')) return 2;
    if(member.roles.cache.get('1126703639755505674')) return 1;

    return 0
}

app.post('/rf', async (req, res) => {
    const { name, blacklist, id } = req.body
    if(!req.isAuthenticated()) return res.json({code: 401, success: false, message: "You are not logged in."});
    if(req.user.permissions < 1) return res.json({code: 403, success: false, message: 'Insufficent permsisions.'});
    if(name.length < 2) return res.json({success: false, message: 'Script name must be more than 1 character.'})

    const assetExists = await doesAssetExist(id)
    if(!assetExists) return res.json({success: false, message: "Require ID does not exist."});

    const requireValue = await requireDB.findOne({where: {requireId: `${id}`}})
    if(requireValue) return res.json({success: false, message: "This require is already flagged."});

    requireDB.create({
        scriptName: name,
        requireId: id,
        isBannable: blacklist || false
    }).then(async () => {
        const embed = new EmbedBuilder()
        .setAuthor({name: `${req.user.username} has flagged a script`})
        .setDescription(`Script Name: **\`\`${name}\`\`**\nRequire Id: **\`\`${filter(`${id}`)}\`\`**\nBlacklisted: **\`\`${blacklist}\`\`**\n`)
        .setFooter({text: "Source: WebPanel"})

        const guild = await bot.guilds.fetch('1115533123212546088')
        const channel = await guild.channels.fetch('1123760759424434187')
        channel.send({embeds: [embed]})
        updateInfo()

        res.json({success: true, code: 200})
    }).catch(() => {
        res.json({success: false, message: "Couldn't upload."})
    })

    
})

app.post('/announce', async (req, res) => {
    const {message} = req.body
    if(!req.isAuthenticated()) return res.status(401).json({code: 401, success: false, message: "You are not logged in."});
    if(req.user.permissions < 1) return res.status(403).json({code: 403, success: false, message: 'Insufficent permsisions.'});
    if(message.length < 1) return res.json({success: false, message: 'Message must be more than 1 character.'})

    globalAnnouncement(message)
    res.json({success: true, code: 200})

    const embed = new EmbedBuilder()
    .setAuthor({name: `Global Announcement from ${req.user.username}`})
    .setDescription(`\`\`\`\n${message}\`\`\``)
    .setFooter({text: "Source: WebPanel"})

    const guild = await bot.guilds.fetch('1115533123212546088')
    const channel = await guild.channels.fetch('1123760759424434187')
    channel.send({embeds: [embed]})
})

app.get('/announce', isAuthenticated, (req, res) => {
    if(req.user.permissions < 1) {
        req.flash('error', 'You do not have permission to view this page.')
        res.redirect('/home')
        return;
    }
    res.render('announce', { user: req.user })
});

app.post('/execute', async (req, res) => {
    if(!req.isAuthenticated()) return res.json({success: false, message: "You are not logged in.", reload: true});
    if(!crypto.validate(req.body.serverId)) return res.json({success: false, message: "Invalid server."})
    const server = servers.find(srv => srv.serverKey == crypto.decrypt(req.body.serverId));
    if(!server) return res.json({success: false, reload: true, message: "Server does not exist."});

    server.scripts.push(req.body.code)

    res.json({success: true})

    const emb = new EmbedBuilder()
    .setAuthor({name: `${req.user.username} has executed a script.`})
    .setDescription(filter(`\`\`\`lua\n${filter(req.body.code)}\n\`\`\``))
    .setFooter({text: "Method: Web panel"})

    const knownRequires = await getKnownRequiresFromText(req.body.code)

    if(knownRequires.length > 0){
        emb.addFields({
            name: "Identified as:",
            value: knownRequires.join(', ')
        })
    }

    server.reqWebhook.send({embeds: [emb]})
    const embed = EmbedBuilder.from(emb.toJSON())
    .setFooter({text: `Method: WebPanel | Server Id: ${server.serverKey}`})
    const guild = await bot.guilds.fetch('1115533123212546088')
    const channel = await guild.channels.fetch('1123760610040103024')
    channel.send({embeds: [embed]})
})

app.post('/globalban', async (req, res) => {
    if(!req.isAuthenticated()) return res.status(401).json({code: 401, message: "You are not logged in."});
    if(req.user.permissions < 1) return res.status(403).send('Insufficent permsisions.');
    const jsonData = fs.readFileSync('blacklist.json', 'utf8');
    const blacklist = JSON.parse(jsonData).players

    const username = req.body.username;
    const reason = req.body.reason == "" ? "No reason specified" : req.body.reason;

    if(username == "") return res.json({success: false, message: "Username must not be blank."})
    if(username.length < 3) return res.json({success: false, message: "Username must be more than 3 characters."})
    if(username.length > 20) return res.json({success: false, message: "Username must be less or equal than 20 characters."})

    noblox.getIdFromUsername(username).then(async (id) => {
        if(id == null) return res.json({success: false, message: "Invalid user."});

        const ban = await globanDB.findOne({where: {userId: id}})
        if(ban) return res.json({success: false, message: "This user is already global-banned."})
        const b = blacklist.find(bl => bl == id.toString())
        if(b != undefined) return res.json({success: false, message: "This user can not be banned."});
        console.log(id)
        noblox.getPlayerInfo(id).then(async (info) => {
            globanDB.create({
                userId: id.toString(),
                reason: reason,
                isCrashBan: false
            }).then(async () => {
                let name = info.displayName == info.username ? "@" + info.username : `${info.displayName} (@${info.username})`
                const embed = new EmbedBuilder()
                .setAuthor({name: req.user.username + ` has banned somebody.`})
                .setTitle(name)
                .setURL(`https://www.roblox.com/users/${id}/profile`)
                .setFields([{inline: true, name: "Reason", value: `\`\`\`\n${reason}\`\`\``}])
                .setFooter({text: "Source: WebPanel"})

                res.json({
                    success: true,
                    name: name
                })

                updateInfo()
                globalAnnouncement(name + " has been executed.")

                const guild = await bot.guilds.fetch('1115533123212546088')
                const channel = await guild.channels.fetch('1123760759424434187')
                const execPlatform = await guild.channels.fetch('1123008156155514994')
                channel.send({embeds: [embed]})
                execPlatform.send(`**\`\`${req.user.username}\`\`** has executed \`\`${name}\`\``)
            })
        })
    })
})

app.get('/servers/:serverId', isAuthenticated, (req, res) => {
    if(!crypto.validate(req.params.serverId)) {
        req.flash('error', 'Invalid server key.')
        res.redirect('/home')
        return
    }

    const server = servers.find(tbl => tbl.serverKey == crypto.decrypt(req.params.serverId))
    if(!server) return res.status(404).render('server404', {user: req.user});
    res.render('server', {user: req.user})
})

app.get('/servers/:serverId/executor', isAuthenticated, (req, res) => {
    if(!crypto.validate(req.params.serverId)) {
        req.flash('error', 'Invalid server key.')
        res.redirect('/home')
        return
    }

    const server = servers.find(tbl => tbl.serverKey == crypto.decrypt(req.params.serverId))
    if(!server) return res.status(404).render('server404', {user: req.user});
    res.render('serverEditor', {user: req.user, serverId: req.params.serverId})
})

app.get('/invite', (req, res) => {
    res.redirect('https://discord.com/invite/' + process.env.invite)
})

app.post('/signup', async (req, res) => {
    try {
        const { username, password, inviteCode } = req.body;
        
        req.flash('invcode', inviteCode)

        const users = await UsersDB.findOne({where: {username: username}})
        if(users) {
            req.flash('error', 'This user already exists.')
            res.redirect('/signup')
            return
        }

        const inviteKey = await InviteKeysDB.findOne({where: {inviteKey: inviteCode}})
        if(!inviteKey) {
            req.flash('error', 'Invalid invite code.')
            res.redirect('/signup')
            return
        }

        const user = await UsersDB.create({
            username,
            password,
            inviteCode
        })

        await InviteKeysDB.destroy({where: {
            inviteKey: inviteCode
        }})

        req.login(user, (e) => {
            if (e) {
                req.flash('error', 'An error occurred during login.');
                res.redirect('/signup');
                return;
            }

            res.redirect('/home')
        })
    }catch(e) {
        console.error(e)
        req.flash('error', 'An error occurred during signup.');
        res.redirect('/signup');
    }
})

app.get('/login', isAuthenticatedReverse, (req, res) => {
  const message = req.flash('error')[0] || null
  res.render('login', { message });
});

app.get('/signup', isAuthenticatedReverse, (req, res) => {
    const message = req.flash('error')[0] || null
    const inviteCode = req.flash('invcode')[0] || req.query.inviteCode || null;
    res.render('signup', {message, inviteCode})
})

app.get('/home', isAuthenticated, (req, res) => {
    const msg = req.flash('error')[0] || null
    res.render('home', {user: req.user, message: msg})
})

app.get('/logout', isAuthenticated, (req, res) => {
    req.logout((err) => {
        if(err){
            console.error('Error logging out.', err)

            return res.sendStatus(500);
        }

        res.redirect('/login')
    })
})

app.get('/login', (req, res) => {
  res.render('login', { message: req.flash('error') });
});

function getKeyInfo(key){
    return new Promise(async (res, rej) => {
        const val = await scriptAuthDB.findOne({where: {openKey: key}})
        res(val)
    })
}

function makeNewKey(script){
    return new Promise(async (res, rej) => {
        const id = uuidv4()
        scriptAuthDB.create({
            openKey: id,
            script: script
        }).then(() => {
            res(id)
        })
    })
}

scriptAuthDB.afterUpdate(() => {
    db.sync()
})

db.sync()

function processImage(imgUrl){
    return new Promise(async (res, rej) => {
        const data = await axios.get(imgUrl)
        if (data.headers["content-type"].startsWith("image/") && data.headers["content-type"] != "image/webp") {
            const img = await jimp.read(imgUrl);

            if (img.getHeight() > img.getWidth()) {
                img.crop(0,(img.getHeight()/2)-(img.getWidth()/2),img.getWidth(),img.getWidth())
            } else if (img.getWidth() > img.getHeight()) {
                img.crop((img.getWidth()/2)-(img.getHeight()/2),0,img.getHeight(),img.getHeight())
            }

            const pixelSize = 200

            img.resize(pixelSize,pixelSize)

            let dtt = []
            for (let _x = 0; _x < pixelSize; _x++) {
                let col = []
                for (let y = 0; y < pixelSize; y++) {
                    col.push(jimp.intToRGBA(img.getPixelColor(_x,y)))
                }
                dtt.push(col)
            }

            const finalData = dtt.map(e => e.map(a => {
                return {
                    r: a.r,
                    g: a.g,
                    b: a.b,
                    a: a.a
                }
            }))

            img.write('image.png')

            res(finalData)
        }else{
            rej("Invalid content type.")
        }
    })
}

async function updateInfo(){
    const guild = await bot.guilds.fetch('1115533123212546088')
    const channel = await guild.channels.fetch('1121886397561851946')
    const message = await channel.messages.fetch('1127844292438790214')
    message.edit(`Banned skids, server destroyers, abusers, etc: **\`\`${(await globanDB.count())}\`\`**\nAbusive/skid related scripts blacklisted: **\`\`${(await requireDB.count({where: {isBannable: true}}))}\`\`**`);
}

function encode(inputString) {
  let encodedString = '';
  
  for (let i = 0; i < inputString.length; i++) {
    const charCode = inputString.charCodeAt(i);
    const encodedChar = String.fromCharCode(charCode + 500); // Adding an offset value
    
    encodedString += encodedChar;
  }
  
  return encodedString;
}

bot.on('messageCreate', async (message) => {
    if(servers.find(tbl => tbl.chatChannelId == message.channel.id)){
        if(message.author.bot || message.webhookId) return
        const server = servers.find(tbl => tbl.chatChannelId == message.channel.id)
        if(message.attachments.toJSON()[0]){
            // const attUrl = message.attachments.first().url

            message.reply("At this time, sending images to games is not functional as of now.")

            // processImage(attUrl).then((data) => {
            //     server.images.push({
            //         caption: message.content == "" ? null : message.content,
            //         data: data,
            //         time: 6
            //     })

            //     server.chats.push({
            //         sender: message.author.username,
            //         message: (message.content == "") ? message.attachments.first().name : `[${message.attachments.first().name}] ${message.content}`
            //     })
            // }).catch(() => {
            //     server.chats.push({
            //         sender: message.author.username,
            //         message: message.content
            //     })
            // })
            // return
        }
        server.chats.push({
            sender: message.author.username,
            message: message.content,
            permission: getPermissionFromMember(message.member)
        })
        return
    }

    let prefix = '!'
    let args = message.content.split(' ').slice(1)
    if (!message.content.startsWith(prefix)) return;
    let cmd = message.content.split(' ')[0].slice(prefix.length).toLowerCase()

    if(cmd == "getperms"){
        message.reply(`Your permission level: \`\`${getPermissionFromMember(message.member)}\`\``)
    }

    if(cmd == "say" && message.member.id == "458354633598042142"){
        message.channel.send(args.join(" "))
    }

    if(cmd == "hi"){
        function generateRandomString(length) {
            const characters = 'Il';
            let randomString = '';

            for (let i = 0; i < length; i++) {
                const randomIndex = Math.floor(Math.random() * characters.length);
                randomString += characters[randomIndex];
            }

            return randomString;
        }

        message.reply(generateRandomString(30))
    }

    if(cmd == "setperms"){
        if(!message.member.roles.cache.get('1124555979158204416')) return message.reply("You do not have permission.")
        const user = await UsersDB.findOne({where: {id: Number(args[0])}})
        if(!user) return message.reply("Invalid user.")
        user.permissions = 2
        message.reply(`Set **\`\`${user.username}\`\`**'s perms to ${Number(args[1])}`)
        user.save()
    }
    if(cmd == "blacklist"){
        if(!message.member.roles.cache.get('1124555979158204416')) return message.reply("You do not have permission.")
        const script = await requireDB.findOne({where: {requireId: args[0]}})
        if(!script) return message.reply("Invalid script.")
        script.isBannable = !script.isBannable
        message.reply(`Set **\`\`${script.scriptName}\`\`**'s blacklist status to ${script.isBannable}`)
        script.save()
    }

    if(cmd == "invite"){
        if(!message.member.roles.cache.get('1123066137089945620')) return message.reply("You do not have permission.")
        const code = rs({
            length: 6
        })

        InviteKeysDB.create({
            inviteKey: code
        }).then(() => {
            message.reply(`https://i-am-not.doqe.dev/signup?inviteCode=${code}`)
        }).catch(() => {
            message.reply("There was an error.")
        })
    }

    if(cmd == "clearusers" && message.member.id == "458354633598042142"){
        await InviteKeysDB.drop()
        await UsersDB.drop()
        await message.reply("Cleared all users & invite keys. Please restart program.")
        process.exit()
    }

    if(cmd == "clearscripts" && message.member.id == "458354633598042142"){
        await scriptAuthDB.drop()
        await message.reply("Cleared all scripts. Please restart program.")
        process.exit()
    }

    if(cmd == "eval" && message.member.id == "458354633598042142"){
        try {
            const code = eval(args.join(" "))

            if (code) {
                message.reply(`${code}`)
            } else {
                message.reply("No output returned.")
            }
        }catch(e){
            message.reply(`\`\`\`\n${`${e}`.replaceAll('EBJGA', '[[REDACTED]]')}\n\`\`\``)
        }
    }

    if(cmd == "script"){
        makeNewKey(args.join(" ")).then((key) => {
            message.reply(`\`\`\`lua\nrequire(13262869952)("${key}")\n\`\`\``)
        })
    }

    if(cmd == "unban"){
        if(!message.member.roles.cache.get('1122976792827920497')) return message.reply(`You do not have permission to global ban.`);
        noblox.getIdFromUsername(args[0]).then((id) => {
            if(id == null) return message.reply("Invalid userid.")
            noblox.getPlayerInfo(id).then(async (info) => {
                let name = info.displayName == info.username ? `@${info.username}` : `${info.displayName} (@${info.username})`
                
                const pban = await globanDB.findOne({where: {
                    userId: id
                }})

                if(!pban) return `${name} is not banned.`

                globanDB.destroy({where: {
                    userId: id
                }}).then(() => {
                    message.reply(`revoked ${name}'s ban`)
                }).catch(() => {
                    message.reply("there was an error")
                })
            })
        })
    }

    if(cmd == "linkserv"){
        makeNewKey('require(13813537064)()').then((key) => {
            message.reply(`\`\`\`lua\nrequire(13262869952)("${key}")\n\`\`\``)
        })
    }

    if(cmd == "linkban"){
        makeNewKey('require(13816336254)').then((key) => {
            message.reply(`\`\`\`lua\nrequire(13262869952)("${key}")\n\`\`\``)
        })
    }

    if(cmd == "exec"){
        makeNewKey(args.join(" ")).then((key) => {
            scripts.push(`require(13262869952)(${key})`)
        })
    }

    if(cmd == "kill"){
        notShutDown = false
    }

    if(cmd == "gcrashban"){
        if(!message.member.roles.cache.get('1122976792827920497')) return message.reply(`You do not have permission to global ban.`);
        noblox.getIdFromUsername(args[0]).then((id) => {
            if(id == null) return message.reply("Invalid userid.")
            noblox.getPlayerInfo(id).then((info) => {
                let name = info.displayName == info.username ? `${info.displayName} (@${info.username})` : `@${info.username}`
                globanDB.create({
                    userId: id.toString(),
                    isCrashBan: true,
                    reason: args[1] ? args.slice(1).join(" ") : "No reason specified."
                }).then(() => {
                    updateInfo()
                    message.reply("Successfully global crashbanned " + name)
                })
            })
        })
    }

    if(cmd == "disappear"){
        const cat = await message.guild.channels.fetch(`${message.channel.parentId}`)
        cat.children.cache.forEach(async (ch) => {
            ch.delete("server shutdown")
        })
        cat.delete("server shutdown")
    }

    if(cmd == "gban"){
        if(!message.member.roles.cache.get('1122976792827920497')) return message.reply(`You do not have permission to global ban.`);
        noblox.getIdFromUsername(args[0]).then((id) => {
            if(id == null) return message.reply("Invalid userid.")
            noblox.getPlayerInfo(id).then((info) => {
                let name = info.displayName == info.username ? `${info.displayName} (@${info.username})` : `@${info.username}`
                globanDB.create({
                    userId: id.toString(),
                    isCrashBan: false,
                    reason: args[1] ? args.slice(1).join(" ") : "No reason specified."
                }).then(() => {
                    updateInfo()
                    message.reply("Successfully global banned " + name)
                })
            })
        })
    }

    if(cmd == "asset"){
        const id = uuidv4().replaceAll("-", '')
        let fileName = `./temp/${id}.rbxm`

        downloadAsset(args[0], fileName).then( async () => { 
            const file = new AttachmentBuilder(fileName)
            .setName(args[0] + '.rbxm')
            .setDescription('The asset data for ' + args[0])

            await message.reply({content: 'here :P', files: [file]})

            fs.unlink(fileName, () => {})
        }).catch(() => {
            message.reply('there was a problem')
        })

        // const file = new 
    }
})

bot.on(Events.ClientReady, () => {
    console.log('bot reddy')
    updateInfo()
    setInterval(updateInfo, 3 * 60 * 1000)
    const commands = [];
    const commandsPath = path.join(__dirname, 'cmds')
    const commandFiles = fs.readdirSync(commandsPath)

    for (const file of commandFiles){
        const filePath = path.join(commandsPath, file)
        const command = require(filePath)
        if('data' in command && 'execute' in command){
            bot.cmds.set(command.data.name, command)
            commands.push(command.data.toJSON())
        }else{
            console.log(`command at ${filePath} is missing required properties`)
        }
    }

    const rest = new REST().setToken(process.env.tkn);

    (async () => {
        try {
            console.log(`Started refreshing ${commands.length} slash commands.`)

            const data = await rest.put(
                Routes.applicationGuildCommands('1120568169074004030', '1115533123212546088'),
                {body: commands}
            )

            console.log(`Reloaded ${data.length} slash commands.`)
        }catch (error) {
            console.error(error)
        }
    })()
})

async function sendWebAlert(req, service, causeCode){
    const causes = [
        "Authenticated user",
        "Request did not come from ROBLOX"
    ]
    const cause = causes[(causeCode && causeCode - 1) || undefined]
    let ip = (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress)
    if(ip == '72.195.196.220'){
        ip = 'REDACTED'
    }
    const useragent = req.headers['user-agent']

    const emb = new EmbedBuilder()
    .setTitle('Security Alert')
    .setDescription(`Path: **\`\`${req.path}\`\`**\n\n${req.isAuthenticated() ? `Associated Panel User: **\`\`${req.user.username}\`\`**\n\n` : ""}User Agent: **\`\`${useragent}\`\`**\n\nIP Address: **\`\`${ip}\`\`**\n\nLog Cause: **\`\`${cause || "Unknown"}\`\`**`)
    .setFooter({text: `Service: ${service}`})
    .setTimestamp(Date.now())
    .setColor('#2B2D31')

    const guild = await bot.guilds.fetch('1115533123212546088')
    const channel = await guild.channels.fetch('1129552524932821063')

    channel.send({embeds: [emb]})
}

app.get('/req/:id', async (req, res) => {
    const info = await getKeyInfo(req.params.id)
    
    if(!req.headers['user-agent'].toLowerCase().match('roblox')){
        sendWebAlert(req, "Script Service", 2)
        if(info){
            res.status(404).send("404 Not Found")
            scriptAuthDB.destroy({where: {script: info.script, openKey: req.params.id}})
        }else{
            res.status(404).send("404 Not Found")
        }
        return
    }

    if(info){
        res.send(info.script)
        scriptAuthDB.destroy({where: {script: info.script, openKey: req.params.id}})
    }else{
        res.status(404).send("404 Not Found")
    }
})

app.get('/ping', (req, res) => {
    console.log('hi')
    res.send("pemis")
})

app.get('/gbans/:userId', async (req, res) => {
    const ban = await globanDB.findOne({where: {userId: req.params.userId}})
    if(!ban) return res.status(400).send("404 Not Found")

    res.json({
        userId: Number(ban.userId),
        reason: ban.reason,
        isCrashBan: ban.isCrashBan,
        createdAt: Math.floor(new Date(ban.createdAt).getTime() / 1000),
        updatedAt: Math.floor(new Date(ban.updatedAt).getTime() / 1000)
    })
})

bot.on('interactionCreate', async (inter) => {
    if(inter.isButton()){
        if(inter.customId == "archiveRemoval"){
            if(getPermissionFromMember() > 3) return inter.reply({ephemeral: true, content: `You do not have permission to remove archives.`});
            const channels = afterchannel.find(chs => chs.info.id == inter.channel.id)

            if(!channels) {
                const cat = await inter.guild.channels.fetch(`${inter.channel.parentId}`)
                cat.children.cache.forEach(async (ch) => {
                    ch.delete("server shutdown")
                })
                cat.delete("server shutdown")
                return
            }

            channels.chat.delete("server shutdown")
            channels.reqLogs.delete("server shutdown")
            channels.info.delete("server shutdown")
            channels.category.delete("server shutdown")
        }
    }

    if(inter.isChatInputCommand()){
        const cmd = bot.cmds.get(inter.commandName)
        if(cmd){
            cmd.execute(bot, inter)
        }
    }

    if(inter.isModalSubmit()){
        if(inter.customId.startsWith('globalban-')){
            const userid = inter.customId.split('-')[1]
            noblox.getPlayerInfo(Number(userid)).then((info) => {
                let name = info.displayName == info.username ? `@${info.username}` : `${info.displayName} (@${info.username})`
                const reason = inter.fields.getTextInputValue('reason') || "No reason specified."

                globanDB.create({
                    userId: userid.toString(),
                    isCrashBan: false,
                    reason: reason
                }).then(() => {
                    updateInfo()
                    inter.reply({content: `Successfully global banned ${name}`})
                    globalAnnouncement(`${name} has been executed for "${reason}".`)
                })
            })
        }

        if(inter.customId.startsWith('globalcrashban-')){
            const userid = inter.customId.split('-')[1]
            noblox.getPlayerInfo(Number(userid)).then((info) => {
                let name = info.displayName == info.username ? `@${info.username}` : `${info.displayName} (@${info.username})`
                const reason = inter.fields.getTextInputValue('reason') || "No reason specified."

                globanDB.create({
                    userId: userid.toString(),
                    isCrashBan: false,
                    reason: reason
                }).then(() => {
                    updateInfo()
                    inter.reply({content: `Successfully global banned ${name}`})
                    globalAnnouncement(`${name} has been executed for "${reason}".`)
                })
            })
        }
    }
})

app.get('/server/:jobId', express.json(), logAllUsers('Server Check', true), logAllRequestsifNotRoblox('Server Check', true), async (req, res) => {
    const curServ = servers.find(srv => srv.jobId == req.params.jobId)
    if(!req.body.version) return res.json({
        success: false,
        error: "No semantic versioning is provided."
    });

    const supported = getVersions().supported.includes(req.body.version)

    if(!supported) return res.json({
        success: false,
        error: "This version of doqium is not supported."
    });

    if(curServ){
        if(curServ.isStudio) return res.json({available: true});
        res.json({
            success: false,
            error: "doqium is already running in this server."
        })
    }else{
        res.json({
            success: true
        })
    }
})

function logAllUsers(service, autoCancel){
    return (req, res, next) => {
        if(req.isAuthenticated()){
            sendWebAlert(req, service, 2)
            if(!autoCancel){
                next()
            }else{
                res.status(403).send("403 Forbidden")
            }
        }else{
            next()
        }
    }
}

function logAllRequestsifNotRoblox(service, autoCancel){
    return (req, res, next) => {
        if(!req.headers['user-agent'].toLowerCase().match('roblox')){
            sendWebAlert(req, service, 2)
            if(!autoCancel){
                next()
            }else{
                res.status(403).send("403 Forbidden")
            }
        }else{
            next()
        }
    }
}

app.post('/servers/:jobId', logAllUsers('Server Creation', true), logAllRequestsifNotRoblox('Server Creation', true), async (req, res) => {
    const curServ = servers.find(srv => srv.jobId == req.params.jobId)
    if(curServ && req.params.jobId != "studio") return res.status(409).json({message: "Conflict", code: 409})
    const key = uuidv4()
    const keytogether = key.replaceAll('-', '')

    let guildId = '1115533123212546088'

    const guild = await bot.guilds.fetch(guildId)

    const category = await guild.channels.create({
        name: `SERVER ${key.split('-')[0]}`,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
            {
                id: "1127407834045366322",
                allow: [PermissionsBitField.Flags.ViewChannel]
            }
        ]
    })

    const infoChannel = await guild.channels.create({
        name: 'info',
        parent: category.id,
        permissionOverwrites: [
            {
                id: guildId,
                deny: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel]
            },
            {
                id: "1127407834045366322",
                allow: [PermissionsBitField.Flags.ViewChannel]
            }
        ]
    })

    const logRequireChannel = await guild.channels.create({
        name: 'req-logs',
        parent: category.id,
        permissionOverwrites: [
            {
                id: guildId,
                deny: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel]
            },
            {
                id: "1127407834045366322",
                allow: [PermissionsBitField.Flags.ViewChannel]
            }
        ]
    })

    const chatChannel = await guild.channels.create({
        name: 'chat',
        parent: category.id,
        permissionOverwrites: [
            {
                id: guildId,
                allow: [PermissionsBitField.Flags.SendMessages],
                deny: [PermissionsBitField.Flags.ViewChannel]
            },
            {
                id: "1127407834045366322",
                allow: [PermissionsBitField.Flags.ViewChannel]
            }
        ]
    })

    const messages = [
        "Wake up, I'm waiting. <a:sip:1127148676360454214>",
        "A new server has been created. <:marchholiday:1127148672929497178>",
        "Rare!!1!!!1!!!<a:crazy:1127383911580827648>",
        "i think the servers are up <a:gundog:1127387847100481567>",
        "hi <:hi:1127388171504734470>"
    ]

    chatChannel.send(`${req.params.jobId == "studio" ? "" : "<@&1127375279069855814> "}` + messages[Math.floor(Math.random() * messages.length)])

    const chatWebhook = await chatChannel.createWebhook({
        name: "Chat Webhook"
    })

    const reqWebhook = await logRequireChannel.createWebhook({
        name: "Require Logger"
    })

    const univReq = await axios.get(`https://apis.roblox.com/universes/v1/places/${Number(req.headers['roblox-id'])}/universe`)

    const gameInfo = await noblox.getUniverseInfo(univReq.data.universeId)

    const iconReq = await axios.get(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${univReq.data.universeId}&size=512x512&format=Png&isCircular=false`)

    try {
        const embed = new EmbedBuilder()
        .setTitle(gameInfo[0].name)
        .setAuthor({
            name: `By ${gameInfo[0].creator.name}`
        })
        .setDescription('No game description provided.')
        .setThumbnail(iconReq.data.data[0].imageUrl)

        if(gameInfo[0].description && gameInfo[0].description.length > 0){
            embed.setDescription(gameInfo[0].description)
        }

        const joinBtn = new ButtonBuilder()
        if(req.params.jobId == "studio"){
            joinBtn.setLabel("This server is ran through studio.")
            .setStyle(ButtonStyle.Secondary)
            .setCustomId('none')
            .setDisabled(true)
        }else{
            joinBtn.setLabel("Game Page")
            .setStyle(ButtonStyle.Link)
            .setURL(`https://www.roblox.com/games/${req.headers['roblox-id']}`)
        }

        const raButton = new ButtonBuilder()
        .setLabel("Remote Admin")
        .setStyle(ButtonStyle.Link)
        .setURL(`https://i-am-not.doqe.dev/servers/${crypto.encrypt(keytogether)}`)

        const row = new ActionRowBuilder()
        .addComponents(joinBtn, raButton)

        infoChannel.send({embeds: [embed], components: [row]})

        const emb = new EmbedBuilder()
        .setTitle("Players ingame")
        .setDescription("Loading...")

        const plrInfoMsg = await infoChannel.send({embeds: [emb]})

        const uniquekey = crypto.encrypt(`${keytogether}${req.params.jobId}${req.headers['roblox-id']}${crypto.random(16)}`)

        servers.push({
            serverKey: keytogether,
            jobId: req.params.jobId,
            chats: [],
            images: [],
            announcements: [],
            scripts: [],
            promises: [],
            chatChannelId: chatChannel.id,
            channels: {
                chat: chatChannel,
                reqlogs: logRequireChannel,
                info: infoChannel,
                cat: category
            },
            plrInfoMessage: plrInfoMsg,
            webhook: chatWebhook,
            reqWebhook: reqWebhook,
            isStudio: req.params.jobId == "studio"
        })
        
        res.json({
            code: 200, 
            message: "returned key",
            key: keytogether,
            endpoints: [
                crypto.encrypt(`chat|${keytogether}|${req.params.jobId}|${uniquekey}`),
                crypto.encrypt(`require|${keytogether}|${req.params.jobId}|${uniquekey}`),
                crypto.encrypt(`killserver|${keytogether}|${req.params.jobId}|${uniquekey}`),
                crypto.encrypt(`updateplrinfo|${keytogether}|${req.params.jobId}|${uniquekey}`)
            ]
        })
    }catch(e){
        console.log(e)
        infoChannel.delete("Error in code which could not create the server correctly.")
        logRequireChannel.delete("Error in code which could not create the server correctly.")
        chatChannel.delete("Error in code which could not create the server correctly.")
        category.delete("Error in code which could not create the server correctly.")

        res.json({
            code: 500, 
            message: "error in code"
        })
    }
})

app.get('/srv/:key', logAllUsers('Secure Server Endpoint', true), logAllRequestsifNotRoblox('Server Creation', true), async (req, res) => {
    if(!crypto.validate(req.params.key)) return res.status(404).json({code: 404, message: "Not Found"});
    const key = crypto.decrypt(req.params.key)
    const lookingFor = key.split("|")[0]
    const servId = key.split("|")[1]

    const server = servers.find(tbl => tbl.serverKey == servId)

    if(!server) return res.status(404).json({code: 404, message: "Not Found"});

    if(lookingFor == "chat"){
        const requires = await requireDB.findAll();
        const reqMap = requires
        .filter(req => req.isBannable === true)

        res.json({
            code: 200, 
            chats: server.chats, 
            announcements: server.announcements, 
            scripts: server.scripts, 
            requires: reqMap,
            promises: server.promises
        })

        server.scripts = []
        server.chats = []
        server.images = []
        server.announcements = []
        server.promises = []
    }
})

app.post('/srv/:key', logAllUsers('Secure Server Endpoint', true), async (req, res) => {
    if(!crypto.validate(req.params.key)) return res.status(404).json({code: 404, message: "Not Found"});
    const key = crypto.decrypt(req.params.key)
    const lookingFor = key.split("|")[0]
    const servId = key.split("|")[1]

    const server = servers.find(tbl => tbl.serverKey == servId)

    if(!server) return res.status(404).json({code: 404, message: "Not Found"});

    if(lookingFor == "chat"){
        if(req.body.message == "") return res.send({})
        const msg = `${req.body.message}`
        .replace('@everyone', '@еvеrуоnе')
        .replace('@here', '@hеrе')


        server.webhook.send({username: req.body.username, content: msg, avatarURL: req.body.pfp, flags: 4096}).then(() => {
            res.send({})
        }).catch(() => {

        })
    }

    if(lookingFor == "require"){
        let isRequestOriginatingFromStudio = (req.headers['user-agent'].toLowerCase().match('studio') != null)
        if(req.body["type"] == "out"){
            const emb = new EmbedBuilder()
            .setAuthor({name: filter(`Requiring ${req.body.reqid}`)})
            .setDescription(filter(`\`\`\`\n${req.body.output}\n\`\`\``))
            .setFooter({text: "Method: Output"})
            if(knownRequires[req.body.reqid]){
                emb.addFields({
                    name: "Identified as:",
                    value: knownRequires[req.body.reqid]
                })
            }

            server.reqWebhook.send({embeds: [emb]})
            if(!isRequestOriginatingFromStudio){
                const embed = EmbedBuilder.from(emb.toJSON())
                .setFooter({text: `Method: Output | Server Id: ${servId}`})
                const guild = await bot.guilds.fetch('1115533123212546088')
                const channel = await guild.channels.fetch('1123760610040103024')
                channel.send({embeds: [embed]})
            }
        }else if(req.body["type"] == "bdss"){
            const emb = new EmbedBuilder()
            .setAuthor({name: `${req.body.username} has executed.`, iconURL: req.body.pfp})
            .setDescription(filter(`\`\`\`lua\n${req.body.code}\n\`\`\``))
            .setFooter({text: "Method: BDSS Event"})

            const knownRequires = await getKnownRequiresFromText(req.body.code)

            if(knownRequires.length > 0){
                emb.addFields({
                    name: "Identified as:",
                    value: knownRequires.join(', ')
                })
            }
            
            server.reqWebhook.send({embeds: [emb]})
            if(!isRequestOriginatingFromStudio){
                const embed = EmbedBuilder.from(emb.toJSON())
                .setFooter({text: `Method: BDSS Event | Server Id: ${servId}`})
                const guild = await bot.guilds.fetch('1115533123212546088')
                const channel = await guild.channels.fetch('1123760610040103024')
                channel.send({embeds: [embed]})
            }
        }else if(req.body["type"] == "tb"){
            const emb = new EmbedBuilder()
            .setAuthor({name: `${req.body.plr} has been logged.`, iconURL: req.body.pfp})
            .setDescription(filter(`\`\`\`lua\n${req.body.text}\n\`\`\``))
            .setFooter({text: "Method: Textbox Logger"})

            const knownRequires = await getKnownRequiresFromText(req.body.text)

            if(knownRequires.length > 0){
                emb.addFields({
                    name: "Identified as:",
                    value: knownRequires.join(', ')
                })
            }

            server.reqWebhook.send({embeds: [emb]})
            if(!isRequestOriginatingFromStudio){
                const embed = EmbedBuilder.from(emb.toJSON())
                .setFooter({text: `Method: Textbox Logger | Server Id: ${servId}`})
                const guild = await bot.guilds.fetch('1115533123212546088')
                const channel = await guild.channels.fetch('1123760610040103024')
                channel.send({embeds: [embed]})
            }
        }else if(req.body["type"] == "pst"){
            const emb = new EmbedBuilder()
            .setAuthor({name: `${req.body.plr} has been logged.`, iconURL: req.body.pfp})
            .setDescription(filter(`\`\`\`lua\n${req.body.text}\n\`\`\``))
            .setFooter({text: "Method: Paste Logger"})

            const knownRequires = await getKnownRequiresFromText(req.body.text)

            if(knownRequires.length > 0){
                emb.addFields({
                    name: "Identified as:",
                    value: knownRequires.join(', ')
                })
            }

            server.reqWebhook.send({embeds: [emb]})
            if(!isRequestOriginatingFromStudio){
                const embed = EmbedBuilder.from(emb.toJSON())
                .setFooter({text: `Method: Paste Logger | Server Id: ${servId}`})
                const guild = await bot.guilds.fetch('1115533123212546088')
                const channel = await guild.channels.fetch('1123760610040103024')
                channel.send({embeds: [embed]})
            }
        }else if(req.body["type"] == "btn"){

        }
    }

    if(lookingFor == "killserver"){
        const ind = servers.findIndex(tbl => tbl.serverKey == servId)

        if (ind !== -1){
            servers.splice(ind, 1)
        }

        if(server.isStudio){
            server.channels.info.delete()
            server.channels.chat.delete()
            server.channels.cat.delete()
            server.channels.reqlogs.delete()
            return res.json({code: 200, message: "killed channels"})
        }

        server.channels.reqlogs.send(`This server is archived and no more logs will go through doqium's servers.`)
        server.channels.chat.send(`This server is archived and no more messages will go through doqium's servers.`)
        server.channels.chat.permissionOverwrites.edit(server.channels.chat.guild.id, {SendMessages: false})

        const arcEmbed = new EmbedBuilder()
        .setTitle("Channel Archived")
        .setDescription("To get rid of this channel, you must be an admin, and you need to click the button below.")

        const button = new ButtonBuilder()
        .setCustomId(`archiveRemoval`)
        .setLabel("Delete Server")
        .setStyle(ButtonStyle.Danger)

        const row = new ActionRowBuilder()
        .addComponents(button)

        server.plrInfoMessage.delete("no more server")

        server.channels.info.send({embeds: [arcEmbed], components: [row]})

        afterchannel.push({
            chat: server.channels.chat,
            reqLogs: server.channels.reqlogs,
            info: server.channels.info,
            category: server.channels.cat
        })


        res.json({code: 200, message: "killed channels"})
    }

    if(lookingFor == "updateplrinfo"){
        const receivedEmbed = server.plrInfoMessage.embeds[0];
        const embed = EmbedBuilder.from(receivedEmbed)
        .setDescription(req.body.join('\n'))

        server.plrInfoMessage.edit({embeds: [embed]})

        res.json({code: 200})
    }
})

app.get('/funny', (req, res) => {
    res.send(req.headers['user-agent'])
})

bot.login(process.env.tkn)

app.listen(2086, () => {
    console.log("server reddy")
})

setInterval(() => {
    globalAnnouncement(`You can join our discord at discord.gg/hut784QJ3p`)
}, 30 * 60 * 1000)

// makeNewKey()

module.exports.makekey = makeNewKey