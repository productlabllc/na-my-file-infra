export interface BuildConfigParams {
  deploymentTarget: 'dev' | 'qa' | 'uat' | 'prod';
  awsRegion: string;
}

export const buildConfig: BuildConfigParams = {
  deploymentTarget: process.env.DEPLOYMENT_TARGET as 'dev' | 'qa' | 'uat' | 'prod',
  awsRegion: process.env.AWS_REGION as string,
};

const appName = process.env.APP_NAME!.toLowerCase().replace(/[ \.]/g, '-');

export interface AppMetadata {
  Name: string;
  AppName: string;
  StackName: string;
  Description: string;
  GitCommit: string;
  GitBranch: string;
  AppVersion: string;
  DeploymentTarget: string;
  OrgName: string;
  OrgNameAbbv: string;
  BusinessUnit: string;
  TechnicalContact: string;
}

export const appTags: AppMetadata = {
  Name: `${appName}-${process.env.DEPLOYMENT_TARGET}`,
  AppName: appName,
  StackName: `${appName}-stack-${process.env.DEPLOYMENT_TARGET}`,
  Description: process.env.APP_DESCRIPTION as string,
  GitCommit: process.env.GIT_COMMIT as string,
  GitBranch: process.env.GIT_BRANCH as string,
  AppVersion: process.env.APP_VERSION as string,
  DeploymentTarget: buildConfig.deploymentTarget,
  OrgName: process.env.ORG_NAME as string,
  OrgNameAbbv: (process.env.ORG_NAME_ABBV as string).toLowerCase(),
  BusinessUnit: process.env.BUSINESS_UNIT as string,
  TechnicalContact: process.env.TECHNICAL_CONTACT as string,
};
