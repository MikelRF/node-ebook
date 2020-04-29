const env = require('./env')
let resUrl
let dbhost
let dbUser
let dbPwd
let db
if (env === 'prod') {
    resUrl = 'http://47.111.252.196/'
    dbhost = '47.111.252.196'
    dbUser = 'root'
    dbPwd = 'root'
    db = 'ebook'
} else if (env === 'dev') {
    resUrl = 'http://192.168.3.2:81'
    dbhost = 'localhost'
    dbUser = 'root'
    dbPwd = 'root'
    db = 'ebook'
}

const category = [
    'Biomedicine',
    'BusinessandManagement',
    'ComputerScience',
    'EarthSciences',
    'Economics',
    'Engineering',
    'Education',
    'Environment',
    'Geography',
    'History',
    'Laws',
    'LifeSciences',
    'Literature',
    'SocialSciences',
    'MaterialsScience',
    'Mathematics',
    'MedicineAndPublicHealth',
    'Philosophy',
    'Physics',
    'PoliticalScienceAndInternationalRelations',
    'Psychology',
    'Statistics'
]

module.exports = {
    resUrl,
    category,
    dbhost,
    dbUser,
    dbPwd,
    db
}
