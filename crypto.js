const crypto = require('crypto')
const algo = 'aes-192-cbc'
const password = 'jdsakljfgdhuio3qej21isy8921udj21shu1ysiou8i2s289su1829su1uhfua09udhui'
const salt = 'y9s812uhdsu21yd89idyu21y8e9iud9w3fd2udiu93hduhsui9urhufhdudshui'

const encrypt = (str) => {
    let key = crypto.scryptSync(password, salt, 24);
    let iv = Buffer.alloc(16);
    let cipher = crypto.createCipheriv(algo, key, iv);
    let encId = cipher.update(str, 'utf8', 'hex')
    encId += cipher.final('hex');
    return encId
}

const decrypt = (str) => {
    let key = crypto.scryptSync(password, salt, 24);
    let iv = Buffer.alloc(16);
    let decipher = crypto.createDecipheriv(algo, key, iv);
    let decrypted = decipher.update(str, 'hex', 'utf8');
    decrypted += decipher.final();
    return decrypted
}

const validate = (str) => {
    try {
        decrypt(str)
        return true
    } catch(err) {
        return false
    }
}

const random = (length) => {
    const bytes = crypto.randomBytes(length);
    return bytes.toString('hex');
}



module.exports = {
    encrypt, decrypt, validate, random
}
