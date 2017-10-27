import AWS = require('aws-sdk');

const deploymentGroupName = 'Staging'
const maxDeployTimeout = 600;
const codedeploy = new AWS.CodeDeploy({
    apiVersion: '2014-10-06',
    region: 'eu-west-1'
});

function delay(ms: number) {
    return new Promise<void>(function(resolve) {
        setTimeout(resolve, ms);
    });
};

async function getStagingApplications() {
    const response = await codedeploy.listApplications().promise();
    const details: { applicationName: string, deploymentGroupName: string }[] = [];
    for (const applicationName of response.applications) {

        const deploymentGroupResult = await codedeploy.getDeploymentGroup({
            applicationName,
            deploymentGroupName
        }).promise()

        if (deploymentGroupResult.deploymentGroupInfo) {
            const { applicationName, deploymentGroupName } = deploymentGroupResult.deploymentGroupInfo;
            
            details.push({ applicationName, deploymentGroupName });
        }

    }
    return details;
};

async function syncStagingDeployments(){
    const details = await getStagingApplications();

    for (const detail of details) {
        const { applicationName, deploymentGroupName } = detail;
        const req = {
            applicationName,
            deploymentGroupName,
            updateOutdatedInstancesOnly: true
        };

        console.log(`Deploying ${applicationName}`);
        const createResult = await codedeploy.createDeployment(req).promise();

        if(createResult.deploymentId){
            let count = 0;
            while(count <= maxDeployTimeout){
                const deployResult = await codedeploy.getDeployment({
                    deploymentId: createResult.deploymentId
                }).promise();

                if(['Succeeded', 'Failed', 'Stopped'].indexOf(deployResult.deploymentInfo.status) > -1){
                    console.log(`${applicationName} finished deploying with status of ${deployResult.deploymentInfo.status}`)
                    break;
                }

                if(count % 10 === 0){
                    console.log(`Current status of deploying ${applicationName} is ${deployResult.deploymentInfo.status}`);
                }

                await delay(1000);
                count++;
            }
        }
    }
};

syncStagingDeployments();
