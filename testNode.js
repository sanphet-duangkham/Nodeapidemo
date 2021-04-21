const http = require('http');

const dbConfig = require('./dbconfig');
const oracledb = require('oracledb');
oracledb.outFormat = oracledb.ARRAY;

var express = require('express');
var moment = require('moment');

var app = express();

var PORT = process.env.PORT || 8089;

app.listen(PORT, function () {
    console.log(`Server running ... on http://localhost:${PORT}`);
});


//Connect Oracledb
// ==============================================
// const connection = oracledb.getConnection({
//     user: "qrms",
//     password: "qrms",
//     connectString: "JUJUBE"
// });


oracledb.getConnection({
    user: dbConfig.user,
    password: dbConfig.password,
    connectString: dbConfig.connectString
}
    , function (err, connection) {
        if (err) {
            console.error(err.message);
            return;
        }

        app.get('/', function (req, res) {
            res.send('404: Bad Request');
        })
        //------------------------------------------------------------------------------------------------------------------------

        app.get('/GetOrderNumber/:shipno/:docno', function (req, res) {
            var Vshipno = parseInt(req.params.shipno)
            var Vdocno = parseInt(req.params.docno)

            try {
                connection.execute(
                    // ==============================================
                    `
                    SELECT * FROM LZ_LOAD_ERROR_TRG
                    WHERE CRATEDATE = (
                        SELECT  MAX(CRATEDATE)
                        FROM LZ_LOAD_ERROR_TRG
                        WHERE SHIP_NO = '${Vshipno}'
                        AND ORDER_NUMBER = '${Vdocno}' )
                    AND SHIP_NO = '${Vshipno}'
                    AND ORDER_NUMBER = '${Vdocno}'
                    `
                    // ==============================================
                    , function (err, result) {
                        var messages = [];

                        if (err) {
                            console.error(err.message);
                            doRelease(connection);
                            return;
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

                        // console.log(result.metaData);
                        // console.log(result.rows);
                        // console.log(messages);

                        res.send({
                            results: 'true',
                            status: 'error',
                            message: messages
                        });

                        doRelease(connection);

                    });
            }
            catch (err) {
                console.error(err.message);
                doRelease(connection);
                return;
                // res.send({
                //     results: 'false',
                // })
            }

        })
        //------------------------------------------------------------------------------------------------------------------------

        app.get('/CheckUserRights/:empid', async function (req, res) {
            var EmpID = parseInt(req.params.empid)

            try {
                await connection.execute(
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
                            doRelease(connection);
                            return;
                        }

                        result.rows.forEach(res => {
                            messages.push({
                                'empid': res[0],
                                'shipno': res[1],
                            })
                            // console.log(messages);
                        })

                        res.send({
                            results: 'true',
                            message: messages
                        });

                        doRelease(connection);
                    });
            }
            catch (err) {
                console.error(err.message);
                doRelease(connection);
                return;
                // res.send({
                //     results: 'false',
                // })
            }
        })
        //------------------------------------------------------------------------------------------------------------------------


    });



function doRelease(connection) {
    connection.release(function (err) {
        if (err) {
            console.error(err.message);
        }
    }
    );
}

