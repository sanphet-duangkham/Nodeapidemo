const oracledb = require('oracledb');
const dbconfig = require('./dbconfig');
// oracledb.outFormat = oracledb.ARRAY;


var express = require('express');
var moment = require('moment');
var cors = require('cors');
var app = express();

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

var PORT = process.env.PORT || 8081;

const server = app.listen(PORT, function () {
    console.log(`Server running ... on http://localhost:${PORT}`);
});

// ======================Distconnection======================== //

function doRelease(connection) {
    connection.release(function (err) {
        if (err) {
            console.error(err.message);
        }
        console.log(`db released successfully`)
    });
}

// ======================Commit======================== //
function doCommit(connection) {
    console.log("before commit");

    connection.commit(function (err) {
        if (err) {
            console.error(err.message);
        }

        console.log("after commit");

        doRelease(connection);
    });
}

// console.log('Try to press CTRL+C or SIGNAL the process with PID: ', process.pid);
// process.on('SIGINT', () => process.exit(1));

// ======================ROUTE======================== //
app.get('/CheckUserRights/:empid', async function (req, res) {
    var EmpID = parseInt(req.params.empid)

    try {
        await oracledb.getConnection({
            user: dbconfig.user,
            password: dbconfig.password,
            connectString: dbconfig.connectString
        }
            , function (err, connection) {
                if (err) {
                    console.error(err.message);
                    return res.status(400).json({
                        message_error: err.message
                    });
                }

                connection.execute(
                    // ==============================================
                    `
                    select 1 from emp_info A , dual B
                    where emp_id = '${EmpID}'
                    and (date_resign is null or  date_resign = '' or to_char(date_resign,'yyyy-mm-dd') > to_char(sysdate,'yyyy-mm-dd') )
                    `
                    // ==============================================
                    , function (err, result) {
                        if (err) {
                            console.error(err.message);
                            return res.status(400).json({
                                message_error: err.message
                            });
                        }

                        if (result.rows == "") {
                            doRelease(connection);
                            return res.status(200).json({
                                results: 'false',
                                status: '0',
                                message: "รหัสพนักงาน " + `${EmpID}` + " ไม่มีสิทธิ์ใช้งานระบบนี้"
                            })
                        }

                        connection.execute(
                            // ==============================================
                            `
                            SELECT * 
                            FROM LZ_USER_RIGHTS 
                            WHERE EMP_ID = '${EmpID}' 
                            ORDER BY SHIP_NO
                            `
                            // ==============================================
                            , function (err, result) {
                                var messages = [];
                                if (err) {
                                    console.error(err.message);
                                    return;
                                }

                                if (result.rows == "") {
                                    doRelease(connection);
                                    return res.status(200).json({
                                        results: 'false',
                                        status: '1',
                                        messages: 'ยังไม่ได้ทำการเพิ่มสิทธิ ใน USER RIGHTS'
                                    })
                                }

                                result.rows.forEach(res => {
                                    messages.push({
                                        'empid': res[0],
                                        'shipno': res[1],
                                    })
                                    // console.log(messages);
                                })

                                res.status(200).json({
                                    results: 'true',
                                    message: messages
                                });
                                console.log(result);
                                doRelease(connection);

                            });
                    }
                );



            }
        );

    }
    catch (err) {
        console.error(err.message);
        doRelease(connection);
        return;
    }
})


app.get('/GetOrderNumber/:shipno/:docno', async function (req, res) {
    // var Vshipno = parseInt(req.params.shipno)
    // var Vdocno = parseInt(req.params.docno)

    try {
        await oracledb.getConnection({
            user: dbconfig.user,
            password: dbconfig.password,
            connectString: dbconfig.connectString
        }
            , function (err, connection) {
                if (err) {
                    console.error(err.message);
                    return res.status(400).json({
                        message_error: err.message
                    });
                }

                connection.execute(
                    // ==============================================
                    `
                    SELECT * FROM LZ_LOAD_ERROR_TRG
                    WHERE CRATEDATE = (
                        SELECT  MAX(CRATEDATE)
                        FROM LZ_LOAD_ERROR_TRG
                        WHERE SHIP_NO = '${req.params.shipno}'
                        AND ORDER_NUMBER = '${req.params.docno}' )
                    AND SHIP_NO = '${req.params.shipno}'
                    AND ORDER_NUMBER = '${req.params.docno}'
                    `
                    // ==============================================
                    , function (err, result) {
                        var messages = [];

                        if (err) {
                            console.error(err.message);
                            doRelease(connection);
                            return res.status(400).json({
                                message_error: err.message
                            });
                        }

                        result.rows.forEach(res => {
                            messages.push({
                                'Shipno': res[0],
                                'Ordernumber': res[1],
                                // 'itemcode': res[2],
                                'Error': res[3],
                                'Createdate': moment(res[4]).format("DD/MM/YYYY h:mm:ss")
                            });
                        })

                        res.status(200).json({
                            results: 'true',
                            status: 'error',
                            message: messages
                        });

                        // console.log(result.metaData);
                        // console.log(result.rows);
                        // console.log(messages);
                        doRelease(connection);

                    });
            }
        );
    }
    catch (err) {
        console.error(err.message);
        doRelease(connection);
        return;
    }

})


app.post('/InsertUserRights', async function (req, res) {
    
    try {
        await oracledb.getConnection({
            user: dbconfig.user,
            password: dbconfig.password,
            connectString: dbconfig.connectString
        }
            , function (err, connection) {
                if (err) {
                    console.error(err.message + " row:194");
                    return;
                }

                connection.execute(
                    // ==============================================
                    `
                    INSERT INTO lz_user_rights (emp_id, ship_no) 
                    VALUES ('${req.body.emp_id}','${req.body.ship_no}')
                    `
                    // ============================================== 
                    , function (err, result) {
                        if (err) {
                            console.error(err.message + " row:206");
                            doRelease(connection);
                            return res.status(400).json({
                                message_error: err.message
                            });
                        };


                        res.status(200).json({
                            results: 'true',
                            message: 'บันทึกเรียบร้อย'
                        })
                        doCommit(connection);
                    }
                )
            }

        );
    }
    catch (err) {
        console.error(err.message + " row:224");
        doRelease(connection);
        return;
    }

})


app.delete('/DeleteUserRights', async function (req, res) {
    var Vempid = parseInt(req.body.emp_id)
    var Vshipno = parseInt(req.body.ship_no)
    try {
        await oracledb.getConnection({
            user: dbconfig.user,
            password: dbconfig.password,
            connectString: dbconfig.connectString
        }
            , function (err, connection) {
                if (err) {
                    console.error(err.message + " row:194");
                    return;
                }

                connection.execute(
                    // ==============================================
                    `
                    DELETE FROM lz_user_rights 
                    WHERE emp_id ='${Vempid}'
                    AND ship_no = '${Vshipno}'  
                    `
                    // ============================================== 
                    , function (err, result) {
                        if (err) {
                            console.error(err.message + " row:206");
                            doRelease(connection);
                            return res.status(400).json({
                                message_error: err.message
                            });
                        };


                        res.status(200).json({
                            results: 'true',
                            message: 'บันทึกเรียบร้อย'
                        })
                        doCommit(connection);
                    }
                )
            }

        );
    }
    catch (err) {
        console.error(err.message + " row:224");
        doRelease(connection);
        return;
    }

})
