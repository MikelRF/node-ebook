const express = require('express')
const mysql = require('mysql')
const constant = require('./const')
const cors = require('cors')

const app = express()
app.use(cors())

// 连接数据库
function connect() {
    return mysql.createConnection({
        host: constant.dbhost,
        user: constant.dbUser,
        password: constant.dbPwd,
        database: constant.db
    })
}

// 随机图书放入“猜你喜欢”
function randomArray(number, total) {
    let rnd = []
    for (let i = 0; i < number; i++) {
        rnd.push(Math.floor(Math.random() * total))
    }
    return rnd
}

// 获取图书
function createData(results, key) {
    return handleData(results[key])
}

function handleData(data) {
    if (!data.cover.startsWith('http://')) {
        data['cover'] = `${constant.resUrl}/img${data.cover}`
    }
    data['selected'] = false
    data['cache'] = false
    return data
}

function handleShelf(data) {
    data.map(item => {
        if (!item.cover.startsWith('http://')) {
            item['cover'] = `${constant.resUrl}/img${item.cover}`
        }
        item.type = 1
        item.selected = false
        item.cache = false
    })
    return data
}

function extendList(data) {
    var map = {}, dest = [];
    for (var i = 0; i < data.length; i++) {
        var ai = data[i];
        if (!map[ai.shelfCategoryName]) {
            dest.push({
                shelfCategoryName: ai.shelfCategoryName,
                type: 2,
                itemList: [ai]
            });
            map[ai.shelfCategoryName] = ai;
        } else {
            for (var j = 0; j < dest.length; j++) {
                var dj = dest[j];
                if (dj.shelfCategoryName === ai.shelfCategoryName) {
                    dj.itemList.push(ai);
                    break;
                }
            }
        }
    }
    let res = []
    for (let i = 0; i < dest.length; i++) {
        if (dest[i].shelfCategoryName === '') {
            dest[i].itemList.forEach(v => res.push(v))
        } else {
            res.push(dest[i])
        }
    }
    return res
}

function concatSql(sql, list) {
    for (let i = 0; i < list.length - 1; i++) { //循环拼接sql
        sql = sql + list[i] + `,`;
    }
    return sql + list[list.length - 1] + `)`;  //拼接结尾
}
// 获取N个分类
function createCategoryIds(n) {
    const arr = []
    constant.category.forEach((item, index) => {
        arr.push(index + 1)
    })
    const result = []
    // 取6个分类
    for (let i = 0; i < n; i++) {
        // 获取的随机数不能重复 向下取整
        const ran = Math.floor(Math.random() * (arr.length - i))
        // 获取分类对应的序号
        result.push(arr[ran])
        // 将已经获取的随机数取代，用最后一位数
        arr[ran] = arr[arr.length - i - 1]
    }
    return result
}

// 获取分类数据
function createCategoryData(data) {
    const categoryIds = createCategoryIds(6)
    const result = []
    categoryIds.forEach(categoryId => { // 与随机分类相同的书， 取前4本
        const subList = data.filter(item => item.category === categoryId).slice(0, 4)
        subList.map(item => {
            return handleData(item)
        })
        result.push({
            category: categoryId,
            list: subList
        })
    })
    return result.filter(item => item.list.length === 4)
}

// 获取书籍评分
app.get('/book/getScore', (req, res) => {
    const conn = connect()
    const fileName = req.query.fileName
    const sql = `select score from book where fileName='${fileName}'`
    conn.query(sql, (err, results) => {
        if (err) {
            res.json({
                error_code: 1,
                msg: err
            })
        } else {
            if (results && results.length === 0) {
                res.json({
                    error_code: 2,
                    msg: '获取分数失败'
                })
            } else {
                res.json({
                    error_code: 0,
                    msg: '获取成功',
                    data: results[0].score
                })
            }
        }
        conn.end()
    })
})

// 更新评论点赞
// app.get('/book/updateCommentScore', (req, res) => {
//     const conn = connect()
//     const id = req.query.id
//     const score = req.query.score * 1
//     const sql = `UPDATE comments SET thumbsUp = thumbsUp + ${score} where id = ${id}`
//     conn.query(sql, (err, results) => {
//         if (err) {
//             res.json({
//                 error_code: 1,
//                 msg: err
//             })
//         } else {
//             if (results && results.length === 0) {
//                 res.json({
//                     error_code: 2,
//                     msg: '更新评分失败'
//                 })
//             } else {
//                 res.json({
//                     error_code: 0,
//                     msg: '更新评分成功',
//                 })
//             }
//         }
//         conn.end()
//     })
// })

// 更新书籍评分
app.get('/book/updateScore', (req, res) => {
    const conn = connect()
    const title = req.query.title
    const currentScore = req.query.currentScore * 1
    const score = req.query.score * 1
    const finalScore = (currentScore + score) / 2
    const sql = `UPDATE book SET score = ${finalScore} where title = '${title}'`
    conn.query(sql, (err, results) => {
        if (err) {
            res.json({
                error_code: 1,
                msg: err
            })
        } else {
            if (results && results.length === 0) {
                res.json({
                    error_code: 2,
                    msg: '更新分数失败'
                })
            } else {
                res.json({
                    error_code: 0,
                    msg: '更新分数成功',
                })
            }
        }
        conn.end()
    })
})

app.get('/book/home', (req, res) => {
    const conn = connect()
    conn.query('select * from book',
        (err, results) => {
            if (err) {
                res.json({
                    error_code: 1,
                    msg: '获取失败'
                })
            } else {
                const length = results.length
                const guessYouLike = []
                const banner = [
                    constant.resUrl + '/banner/banner1.jpg',
                    constant.resUrl + '/banner/banner2.jpg',
                    constant.resUrl + '/banner/banner3.jpg'
                ]
                const recommend = []
                const featured = []
                const randomBook = []
                const categoryList = createCategoryData(results)
                const categories = [
                    {
                        category: 1,
                        num: 56,
                        img1: constant.resUrl + '/cover/cs/A978-3-319-62533-1_CoverFigure.jpg',
                        img2: constant.resUrl + '/cover/cs/A978-3-319-89366-2_CoverFigure.jpg'
                    },
                    {
                        category: 2,
                        num: 51,
                        img1: constant.resUrl + '/cover/ss/A978-3-319-61291-1_CoverFigure.jpg',
                        img2: constant.resUrl + '/cover/ss/A978-3-319-69299-9_CoverFigure.jpg'
                    },
                    {
                        category: 3,
                        num: 32,
                        img1: constant.resUrl + '/cover/eco/A978-3-319-69772-7_CoverFigure.jpg',
                        img2: constant.resUrl + '/cover/eco/A978-3-319-76222-7_CoverFigure.jpg'
                    },
                    {
                        category: 4,
                        num: 60,
                        img1: constant.resUrl + '/cover/edu/A978-981-13-0194-0_CoverFigure.jpg',
                        img2: constant.resUrl + '/cover/edu/978-3-319-72170-5_CoverFigure.jpg'
                    },
                    {
                        category: 5,
                        num: 23,
                        img1: constant.resUrl + '/cover/eng/A978-3-319-39889-1_CoverFigure.jpg',
                        img2: constant.resUrl + '/cover/eng/A978-3-319-00026-8_CoverFigure.jpg'
                    },
                    {
                        category: 6,
                        num: 42,
                        img1: constant.resUrl + '/cover/env/A978-3-319-12039-3_CoverFigure.jpg',
                        img2: constant.resUrl + '/cover/env/A978-4-431-54340-4_CoverFigure.jpg'
                    },
                    {
                        category: 7,
                        num: 7,
                        img1: constant.resUrl + '/cover/geo/A978-3-319-56091-5_CoverFigure.jpg',
                        img2: constant.resUrl + '/cover/geo/978-3-319-75593-9_CoverFigure.jpg'
                    },
                    {
                        category: 8,
                        num: 18,
                        img1: constant.resUrl + '/cover/his/978-3-319-65244-3_CoverFigure.jpg',
                        img2: constant.resUrl + '/cover/his/978-3-319-92964-4_CoverFigure.jpg'
                    },
                    {
                        category: 9,
                        num: 13,
                        img1: constant.resUrl + '/cover/law/2015_Book_ProtectingTheRightsOfPeopleWit.jpeg',
                        img2: constant.resUrl + '/cover/law/2016_Book_ReconsideringConstitutionalFor.jpeg'
                    },
                    {
                        category: 10,
                        num: 24,
                        img1: constant.resUrl + '/cover/ls/A978-3-319-27288-7_CoverFigure.jpg',
                        img2: constant.resUrl + '/cover/ls/A978-1-4939-3743-1_CoverFigure.jpg'
                    },
                    {
                        category: 11,
                        num: 6,
                        img1: constant.resUrl + '/cover/lit/2015_humanities.jpg',
                        img2: constant.resUrl + '/cover/lit/A978-3-319-44388-1_CoverFigure_HTML.jpg'
                    },
                    {
                        category: 12,
                        num: 14,
                        img1: constant.resUrl + '/cover/bio/2016_Book_ATimeForMetabolismAndHormones.jpeg',
                        img2: constant.resUrl + '/cover/bio/2017_Book_SnowSportsTraumaAndSafety.jpeg'
                    },
                    {
                        category: 13,
                        num: 16,
                        img1: constant.resUrl + '/cover/bm/2017_Book_FashionFigures.jpeg',
                        img2: constant.resUrl + '/cover/bm/2018_Book_HeterogeneityHighPerformanceCo.jpeg'
                    },
                    {
                        category: 14,
                        num: 16,
                        img1: constant.resUrl + '/cover/es/2017_Book_AdvancingCultureOfLivingWithLa.jpeg',
                        img2: constant.resUrl + '/cover/es/2017_Book_ChinaSGasDevelopmentStrategies.jpeg'
                    },
                    {
                        category: 15,
                        num: 2,
                        img1: constant.resUrl + '/cover/ms/2018_Book_ProceedingsOfTheScientific-Pra.jpeg',
                        img2: constant.resUrl + '/cover/ms/2018_Book_ProceedingsOfTheScientific-Pra.jpeg'
                    },
                    {
                        category: 16,
                        num: 9,
                        img1: constant.resUrl + '/cover/mat/2016_Book_AdvancesInDiscreteDifferential.jpeg',
                        img2: constant.resUrl + '/cover/mat/2016_Book_ComputingCharacterizationsOfDr.jpeg'
                    },
                    {
                        category: 17,
                        num: 20,
                        img1: constant.resUrl + '/cover/map/2013_Book_TheSouthTexasHealthStatusRevie.jpeg',
                        img2: constant.resUrl + '/cover/map/2016_Book_SecondaryAnalysisOfElectronicH.jpeg'
                    },
                    {
                        category: 18,
                        num: 16,
                        img1: constant.resUrl + '/cover/phi/2015_Book_TheOnlifeManifesto.jpeg',
                        img2: constant.resUrl + '/cover/phi/2017_Book_Anti-VivisectionAndTheProfessi.jpeg'
                    },
                    {
                        category: 19,
                        num: 10,
                        img1: constant.resUrl + '/cover/phy/2016_Book_OpticsInOurTime.jpeg',
                        img2: constant.resUrl + '/cover/phy/2017_Book_InterferometryAndSynthesisInRa.jpeg'
                    },
                    {
                        category: 20,
                        num: 26,
                        img1: constant.resUrl + '/cover/psa/2016_Book_EnvironmentalGovernanceInLatin.jpeg',
                        img2: constant.resUrl + '/cover/psa/2017_Book_RisingPowersAndPeacebuilding.jpeg'
                    },
                    {
                        category: 21,
                        num: 3,
                        img1: constant.resUrl + '/cover/psy/2015_Book_PromotingSocialDialogueInEurop.jpeg',
                        img2: constant.resUrl + '/cover/psy/2015_Book_RethinkingInterdisciplinarityA.jpeg'
                    },
                    {
                        category: 22,
                        num: 1,
                        img1: constant.resUrl + '/cover/sta/2013_Book_ShipAndOffshoreStructureDesign.jpeg',
                        img2: constant.resUrl + '/cover/sta/2013_Book_ShipAndOffshoreStructureDesign.jpeg'
                    }
                ]
                // 猜你喜欢
                randomArray(9, length).forEach(key => {
                    guessYouLike.push(createData(results, key)) // 获取随机图书
                })
                // 推荐
                randomArray(3, length).forEach(key => {
                    recommend.push(createData(results, key)) // 获取随机图书
                })
                // 精选
                randomArray(6, length).forEach(key => {
                    featured.push(createData(results, key)) // 获取随机图书
                })
                // 随机推荐
                randomArray(1, length).forEach(key => {
                    randomBook.push(createData(results, key)) // 获取随机图书
                })
                res.json({
                    guessYouLike,
                    banner,
                    recommend,
                    featured,
                    randomBook,
                    categoryList,
                    categories,
                    length
                })
                conn.end()
            }
        })
})

app.get('/book/detail', (req, res) => {
    const conn = connect()
    const fileName = req.query.fileName
    const sql = `select * from book where fileName='${fileName}'`
    conn.query(sql, (err, results) => {
        if (err) {
            res.json({
                error_code: 1,
                msg: '电子书详情获取失败'
            })
        } else {
            if (results && results.length === 0) {
                res.json({
                    error_code: 1,
                    msg: '电子书详情获取失败'
                })
            } else {
                const book = handleData(results[0])
                res.json({
                    error_code: 0,
                    msg: '获取成功',
                    data: book
                })
            }
        }
        conn.end()
    })
})

app.get('/book/list', (req, res) => {
    const conn = connect()
    const category = req.query.category
    const sql = `select * from book where categoryText = '${category}'`
    const sql2 = 'select * from book'
    conn.query(category ? sql : sql2,
        (err, results) => {
            if (err) {
                res.json({
                    error_code: 1,
                    msg: '获取失败'
                })
            } else {
                results.map(item => handleData(item))
                const data = {}
                constant.category.forEach(categoryText => {
                    data[categoryText] = results.filter(item => item.categoryText === categoryText)
                })
                res.json({
                    error_code: 0,
                    msg: '获取成功',
                    data: data,
                    total: results.length
                })
            }
            conn.end()
        })
})

app.get('/book/flatList', (req, res) => {
    const conn = connect()
    conn.query('select * from book',
        (err, results) => {
            if (err) {
                res.json({
                    error_code: 1,
                    msg: '获取失败'
                })
            } else {
                results.map(item => handleData(item))
                res.json({
                    error_code: 0,
                    msg: '获取成功',
                    data: results,
                    total: results.length
                })
            }
            conn.end()
        })
})

app.get('/home/login', (req, res) => {
    const conn = connect()
    const userName = req.query.userName
    const passWord = req.query.passWord
    const sql = `select * from users where username='${userName}' and password = '${passWord}'`
    conn.query(sql, (err, results) => {
        if (err) {
            res.json({
                error_code: 1,
                msg: 'err'
            })
        } else {
            if (results && results.length === 0) {
                res.json({
                    error_code: 2,
                    msg: '错误的用户名或密码!'
                })
            } else {
                const user = results[0]
                res.json({
                    error_code: 0,
                    msg: '登陆成功，欢迎',
                    data: user
                })
            }
        }
        conn.end()
    })
})

app.get('/home/reSetPass', (req, res) => {
    const conn = connect()
    const userName = req.query.userName
    const passWord = req.query.passWord
    const sql = `UPDATE users SET password = ${passWord} where username = '${userName}'`
    conn.query(sql, (err, results) => {
        if (err) {
            res.json({
                error_code: 1,
                msg: '错误！'
            })
        } else {
            if (results && results.length === 0) {
                res.json({
                    error_code: 2,
                    msg: '该用户不存在！'
                })
            } else {
                res.json({
                    error_code: 0,
                    msg: '修改成功',
                })
            }
        }
        conn.end()
    })
})

app.get('/home/register', (req, res) => {
    const conn = connect()
    const userName = req.query.userName
    const passWord = req.query.passWord
    const sql = `INSERT INTO users (username, password) VALUES ('${userName}', '${passWord}')`
    conn.query(sql, (err, results) => {
        if (err) {
            res.json({
                error_code: 1,
                msg: err
            })
        } else {
            res.json({
                error_code: 0,
                msg: '注册成功',
            })
        }
        conn.end()
    })
})

app.get('/detail/comment', (req, res) => {
    const conn = connect()
    const title = req.query.title
    const sql = `select * from comments where title = '${title}'`
    conn.query(sql, (err, results) => {
        if (err) {
            res.json({
                error_code: 1,
                msg: err
            })
        } else {
            if (results && results.length === 0) {
                res.json({
                    error_code: 2,
                    msg: '沙发！！！'
                })
            } else {
                const id = randomArray(1, results.length)[0]
                res.json({
                    error_code: 0,
                    msg: '获取成功',
                    data: results[id]
                })
            }
        }
        conn.end()
    })
})

app.get('/submit/comment', (req, res) => {
    const conn = connect()
    const title = req.query.title
    const userName = req.query.userName
    const text = req.query.comment
    const score = req.query.score
    const time = new Date().toLocaleString()
    const sql = `INSERT INTO comments (username, comment, title, score, date) VALUES ('${userName}', '${text}', '${title}', ${score}, '${time}')`
    conn.query(sql, (err, results) => {
        if (err) {
            res.json({
                error_code: 1,
                msg: err
            })
        } else {
            res.json({
                error_code: 0,
                msg: '插入成功',
            })
        }
        conn.end()
    })
})

app.get('/detail/commentList', (req, res) => {
    const conn = connect()
    const title = req.query.title
    const sql = `select * from comments where title = '${title}'`
    conn.query(sql, (err, results) => {
        if (err) {
            res.json({
                error_code: 1,
                msg: err
            })
        } else {
            if (results && results.length === 0) {
                res.json({
                    error_code: 2,
                    msg: '还没有评论...'
                })
            } else {
                res.json({
                    error_code: 0,
                    msg: '获取成功',
                    data: results
                })
            }
        }
        conn.end()
    })
})

app.get('/shelf/addToShelf', (req, res) => {
    const conn = connect()
    const book = JSON.parse(req.query.book)
    const userName = req.query.userName
    const sql = `select * from bookshelf where username = '${userName}' and bookId = ${book.id}`
    conn.query(sql, (err, results) => {
        if (err) {
            res.json({
                error_code: 1,
                msg: err
            })
        } else {
            if (results && results.length > 0) {
                res.json({
                    error_code: 2,
                    msg: '该书已在存在'
                })
            } else {
                const sql1 = `INSERT INTO bookshelf (username, bookId, shelfCategoryName)
    VALUES ('${userName}', ${book.id}, '${book.shelfCategoryName ? book.shelfCategoryName : ''}')`
                conn.query(sql1, (err, results) => {
                    if (err) {
                        res.json({
                            error_code: 1,
                            msg: err
                        })
                    } else if (results && results.length === 0) {
                        res.json({
                            error_code: 2,
                            msg: '加入失败'
                        })
                    } else {
                        res.json({
                            error_code: 0,
                            msg: '加入成功'
                        })
                    }
                })
            }
        }
        conn.end()
    })
})

app.get('/shelf/getBookShelf', (req, res) => {
    const conn = connect()
    const userName = req.query.userName
    const sql = `SELECT bookId, shelfCategoryName, author, fileName, cover, title, publisher, category, categoryText, language, rootFile, score
FROM bookshelf, book WHERE bookshelf.bookId = book.id and bookshelf.username = '${userName}'`
    conn.query(sql, (err, results) => {
        if (err) {
            res.json({
                error_code: 1,
                msg: err
            })
        } else {
            if (results && results.length === 0) {
                res.json({
                    error_code: 2,
                    msg: '无收藏'
                })
            } else {
                res.json({
                    error_code: 0,
                    msg: '获取成功',
                    data: extendList(handleShelf(results))
                })
            }
        }
        conn.end()
    })
})

app.get('/shelf/removeBookFromShelf', (req, res) => {
    const conn = connect()
    const list = req.query.list
    const userName = req.query.userName
    let sql = `DELETE FROM bookshelf WHERE username = '${userName}' and bookId in (`
    sql = concatSql(sql,list)
    conn.query(sql, (err, results) => {
        if (err) {
            res.json({
                error_code: 1,
                msg: err
            })
        } else {
            if (results && results.length === 0) {
                res.json({
                    error_code: 2,
                    msg: '删除失败',
                })
            } else {
                res.json({
                    error_code: 0,
                    msg: '删除成功',
                })
            }
        }
        conn.end()
    })
})

app.get('/shelf/getCategoryList', (req, res) => {
    const conn = connect()
    const shelfCategoryName = req.query.shelfCategoryName
    const userName = req.query.userName
    const sql = `SELECT bookId, shelfCategoryName, author, fileName, cover, title, publisher, category, categoryText, language, rootFile, score
FROM bookshelf, book WHERE shelfCategoryName = '${shelfCategoryName}' and bookshelf.username = '${userName}' and book.id = bookshelf.bookId`
    conn.query(sql, (err, results) => {
        if (err) {
            res.json({
                error_code: 1,
                msg: err
            })
        } else {
            if (results && results.length === 0) {
                res.json({
                    error_code: 2,
                    msg: '获取失败',
                })
            } else {
                res.json({
                    error_code: 0,
                    msg: '获取成功',
                    data: extendList(handleShelf(results))
                })
            }
        }
        conn.end()
    })
})

app.get('/shelf/moveToGroup', (req, res) => {
    const conn = connect()
    const list = req.query.list
    const userName = req.query.userName
    const groupName = req.query.groupName
    let sql = `UPDATE bookshelf SET shelfCategoryName = '${groupName}' WHERE username = '${userName}' and bookId in (`
    sql = concatSql(sql, list)
    conn.query(sql, (err, results) => {
        if (err) {
            res.json({
                error_code: 1,
                msg: err
            })
        } else {
            if (results && results.length === 0) {
                res.json({
                    error_code: 2,
                    msg: '分组失败',
                })
            } else {
                res.json({
                    error_code: 0,
                    msg: '分组成功',
                })
            }
        }
        conn.end()
    })
})

app.get('/shelf/moveOutOfGroup', (req, res) => {
    const conn = connect()
    const list = req.query.list
    const userName = req.query.userName
    let sql = `UPDATE bookshelf SET shelfCategoryName = '' WHERE username = '${userName}' and bookId in (`
    sql = concatSql(sql,list)
    conn.query(sql, (err, results) => {
        if (err) {
            res.json({
                error_code: 1,
                msg: err
            })
        } else {
            if (results && results.length === 0) {
                res.json({
                    error_code: 2,
                    msg: '移出分组失败',
                })
            } else {
                res.json({
                    error_code: 0,
                    msg: '移出分组成功',
                })
            }
        }
        conn.end()
    })
})

app.get('/shelf/changeGroupName', (req, res) => {
    const conn = connect()
    const newName = req.query.newName
    const oldName = req.query.oldName
    const userName = req.query.userName
    const sql = `UPDATE bookshelf SET shelfCategoryName = '${newName}' WHERE username = '${userName}' and shelfCategoryName = '${oldName}'`
    conn.query(sql, (err, results) => {
        if (err) {
            res.json({
                error_code: 1,
                msg: err
            })
        } else {
            if (results && results.length === 0) {
                res.json({
                    error_code: 2,
                    msg: '修改失败',
                })
            } else {
                res.json({
                    error_code: 0,
                    msg: '修改成功',
                })
            }
        }
        conn.end()
    })
})

app.get('/shelf/duplicateGroupName', (req, res) => {
    const conn = connect()
    const newName = req.query.newName
    const userName = req.query.userName
    const sql = `SELECT * FROM bookshelf where username = '${userName}' and shelfCategoryName = '${newName}'`
    conn.query(sql, (err, results) => {
        if (err) {
            res.json({
                error_code: 1,
                msg: err
            })
        } else {
            if (results && results.length > 0) {
                res.json({
                    error_code: 2,
                    msg: '有重复',
                })
            } else {
                res.json({
                    error_code: 0,
                    msg: '无重复',
                })
            }
        }
        conn.end()
    })
})

const server = app.listen(3000, () => {
    const host = server.address().address
    const port = server.address().port
    console.log('server is listening at http://%s:%s', host, port)
})
