import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

interface AwsBuildStackProps extends cdk.StackProps {
  /** ARN of the CodeStar Connection to GitHub (must be created & confirmed in AWS Console) */
  connectionArn: string;
  /** GitHub owner (user or org) */
  githubOwner: string;
  /** Source repo name on GitHub - triggers the pipeline */
  sourceRepoName: string;
  /** Target repo name on GitHub - receives build output commits */
  targetRepoName: string;
  /** Branch to track (default: main) */
  branch?: string;
  /** Name of the Secrets Manager secret holding the GitHub PAT */
  githubTokenSecretName?: string;
}

export class AwsBuildStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AwsBuildStackProps) {
    super(scope, id, props);

    const branch = props.branch ?? 'main';
    const tokenSecretName = props.githubTokenSecretName ?? 'github-pat';

    // Look up existing Secrets Manager secret holding the GitHub PAT
    const githubTokenSecret = secretsmanager.Secret.fromSecretNameV2(
      this, 'GitHubToken', tokenSecretName,
    );

    // CodeBuild project
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      projectName: 'build-and-commit',
      environment: {
        buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0,
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
      environmentVariables: {
        GITHUB_OWNER: {
          value: props.githubOwner,
        },
        TARGET_REPO_NAME: {
          value: props.targetRepoName,
        },
        TARGET_BRANCH: {
          value: branch,
        },
        GITHUB_TOKEN: {
          type: codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
          value: tokenSecretName,
        },
      },
    });

    // Grant CodeBuild read access to the secret
    githubTokenSecret.grantRead(buildProject);

    // Pipeline artifacts
    const sourceOutput = new codepipeline.Artifact('SourceOutput');

    // Pipeline
    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'build-pipeline',
      stages: [
        {
          stageName: 'Source',
          actions: [
            new codepipeline_actions.CodeStarConnectionsSourceAction({
              actionName: 'SourceRepo',
              connectionArn: props.connectionArn,
              owner: props.githubOwner,
              repo: props.sourceRepoName,
              branch,
              output: sourceOutput,
              triggerOnPush: true,
            }),
          ],
        },
        {
          stageName: 'Build',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'BuildAndCommit',
              project: buildProject,
              input: sourceOutput,
            }),
          ],
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'PipelineName', {
      value: pipeline.pipelineName,
      description: 'CodePipeline name',
    });
  }
}
