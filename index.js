import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

function createChartData(groupedData){

    //create keys (queue_names or categories) from dataset
    var queueKeys = Object.keys(groupedData);
        var categoryChartData = [];
        var categoryChartDataSum = [];
        
        queueKeys.forEach((category) =>{

            var subCategories = Object.keys(groupedData[category]);
            subCategories.forEach((subcategory)=>{
                var x = groupedData[category][subcategory].length;
                categoryChartData.push(x);
            });
            
            //
            const sum = categoryChartData.reduce((acc, current) => acc + current,0);
            categoryChartDataSum.push(sum);
        });
        

    const chartData = {
        labels: queueKeys,
        datasets:[{
            label: "311 Calls - Categories",
            data : categoryChartDataSum,
        }]
    };
    return chartData;
}

app.get("/", async(req,res)=>{

    const date = new Date();
    date.setDate(date.getDate() - 13); // Last 14 days including today

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // 0-indexed
    const day = String(date.getDate()).padStart(2, '0');
    const formattedDatetime = `${year}-${month}-${day} 00:00:00`;  // start of day

    try{

        var url = "https://services2.arcgis.com/11XBiaBYA9Ep0yNJ/arcgis/rest/services/311_Call_Details/FeatureServer/0/query";
        const result = await axios.get(url, { 
            params: {
                where: `ARRIVAL_DATETIME >= DATE '${formattedDatetime}'`,
                outFields: "*",
                outSR: 4326,
                f: "json"
            }
        });

        //DATA TRANSFORMATION TO GROUP BY QUEUE_NAME AND THEN WRAPUP_NAME

        //removes "features" on the dataset and creates one with all attributes as keys
        const resultCalls = result.data.features.map(feature => feature.attributes);
        
        //group by QUEUE_NAME and then WRAPUP_NAME- using reduce()
        const groupedResult = resultCalls.reduce((groupedRecords, call) => {
        
            // check if a queue name exists. 
            if (!groupedRecords[call.QUEUE_NAME]) {

                // replace null queue name with "Unknown"
                if (call.QUEUE_NAME === null) {
                    call.QUEUE_NAME = "Unknown";
                }
                //if it does not exist, create a grouped obj by queue_name
                groupedRecords[call.QUEUE_NAME] = {};
            }

            //check if wrap name exists inside a queue_name qroup 
            if (!groupedRecords[call.QUEUE_NAME][call.WRAPUP_NAME]) {

                // replace null wrap name with "Unknown"
                if (call.WRAPUP_NAME === null) {
                    call.WRAPUP_NAME = "Unknown";
                }
                //if not, create an array of calls grouped by wrap name
                groupedRecords[call.QUEUE_NAME][call.WRAPUP_NAME] = [];
                
            }

            //add the call in the appropriate wrapupname array
            groupedRecords[call.QUEUE_NAME][call.WRAPUP_NAME].push(call);

            /* groupedRecords will be structured as follows : 
                keys will be queue names  
                every key will have several sub categories as keys 
                every sub category is an array of calls (json objects)

                for eg : { 
                    QUEUE_NAME : {
                        WRAPUP_NAME : [],
                        ....
                        ANOTHER WRAPUP_NAME : []
                    }
                }
            */

            return groupedRecords;

        }, {});

        //CREATING INITIAL CHART DATA - CALL COUNT BY CATEGORY
        
        res.render("index.ejs",{
            content: groupedResult,
            dataChart : createChartData(groupedResult),
        });
    }
    catch(error){
        console.log(error.message);
        res.send(501);
    };
});

app.post("/submit", async(req,res)=>{
    console.log(req.body);
});

app.listen(port);
