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

var PORT = process.env.PORT || 8090;

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
app.get('/TsdcDownload/:shipno/:date', async function (req, res) {
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
                    SELECT DISTINCT ORDER_NUMBER_ITT,(SELECT PATHNAME FROM LZ_GENERATE_PATH)|| PACKING_FILE_SERVER AS PACKING
                    , (SELECT PATHNAME FROM LZ_GENERATE_PATH) || INV_FILE_SERVER AS INVOICE, CREATE_DATE_ITT AS CREATEDATE
                    , nvl(PACKING_FILE_SERVER,'NULL') AS PACKING_1, INV_FILE_SERVER AS INVOICE_1
                    FROM LZ_ITEM_TRANSACTION
                    WHERE SHIP_NO_ITT = '${req.params.shipno}'
                    AND TO_CHAR(CREATE_DATE_ITT,'YYYY-MM-DD') = '${req.params.date}'
                    ORDER BY ORDER_NUMBER_ITT,CREATEDATE        
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
                                'Ordernumber': res[0],
                                'Packing': res[1],
                                'Invoice': res[2],
                                'Createdate': res[3],
                            });
                        })

                        res.status(200).json({
                            results: 'true',
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