import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

function getDateFilter(){

    const date = new Date();
    date.setDate(date.getDate() - 13); // Last 14 days including today

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // 0-indexed
    const day = String(date.getDate()).padStart(2, '0');
    const formattedDatetime = `${year}-${month}-${day} 00:00:00`;  // start of day

    return formattedDatetime;
}

function transformData(data){

        //DATA TRANSFORMATION TO GROUP BY QUEUE_NAME AND THEN WRAPUP_NAME

        //removes "features" on the dataset and creates one with all attributes as keys
        const resultCalls = data.map(feature => feature.attributes);
        
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

        return groupedResult;
}

function createCategoryChartData(groupedData){

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

function createSubCategoryChartData(groupedData){

    //create keys (wrapup_names or subcategories) from dataset
    var queueKeys = Object.keys(groupedData);
        var subCategoryChartData = [];
        
        queueKeys.forEach((category) =>{
                var x = groupedData[category].length;
                subCategoryChartData.push(x);
            });
            
            const chartData = {
                labels: queueKeys,
                datasets:[{
                    label: "311 Calls - Categories",
                    data : subCategoryChartData,
                }]
            };
            return chartData;
            
    }

async function get311Data(){

    try{
    var formattedDatetime = getDateFilter();
    var url = "https://services2.arcgis.com/11XBiaBYA9Ep0yNJ/arcgis/rest/services/311_Call_Details/FeatureServer/0/query";
    const result = await axios.get(url, { 
        params: {
            where: `ARRIVAL_DATETIME >= DATE '${formattedDatetime}'`,
            outFields: "*",
            outSR: 4326,
            f: "json"
        }
    });

    const groupedResult = transformData(result.data.features);
    return groupedResult;
    }
    catch(error){
         console.log(error.message);
        res.send(501);
    }

}

app.get("/", async (req,res)=> {

    try{
        const groupedResult = await get311Data();

        //CREATING INITIAL CHART DATA - CALL COUNT BY CATEGORY;

        res.render("index.ejs",{
            content: groupedResult,
            dataChart : createCategoryChartData(groupedResult)
        });
    }
    catch(error){
        console.log(error.message);
        res.send(501);
    }
});


app.post("/submit", async(req,res)=>{

    try{
        //get transformed 311 data
        const groupedResult = await get311Data();
        const selectedChartCategory = groupedResult[req.body.queueName];

        //CREATING SELECTED CHART DATA - CALL COUNT BY SUBCATEGORY;

        res.render("index.ejs",{
            content: groupedResult,
            dataChart : createSubCategoryChartData(selectedChartCategory)
        });
    }
    catch(error){
        console.log(error.message);
        res.send(501);
    }


});

app.listen(port);
