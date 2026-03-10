import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as iam from 'aws-cdk-lib/aws-iam';

export class AwsBuildStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Source repository - triggers the pipeline
    const sourceRepo = new codecommit.Repository(this, 'SourceRepo', {
      repositoryName: 'source-repo',
      description: 'Source repository that triggers the build pipeline',
    });

    // Target repository - receives build output commits
    const targetRepo = new codecommit.Repository(this, 'TargetRepo', {
      repositoryName: 'target-repo',
      description: 'Target repository that receives build output',
    });

    // CodeBuild project
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      projectName: 'build-and-commit',
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
      environmentVariables: {
        TARGET_REPO_URL: {
          value: targetRepo.repositoryCloneUrlGrc,
        },
        TARGET_BRANCH: {
          value: 'main',
        },
      },
    });

    // Grant CodeBuild permission to push to the target repo
    targetRepo.grantPullPush(buildProject.role!);

    // Pipeline artifacts
    const sourceOutput = new codepipeline.Artifact('SourceOutput');
    const targetOutput = new codepipeline.Artifact('TargetOutput');

    // Pipeline
    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'build-pipeline',
      stages: [
        {
          stageName: 'Source',
          actions: [
            new codepipeline_actions.CodeCommitSourceAction({
              actionName: 'SourceRepo',
              repository: sourceRepo,
              branch: 'main',
              output: sourceOutput,
            }),
            new codepipeline_actions.CodeCommitSourceAction({
              actionName: 'TargetRepo',
              repository: targetRepo,
              branch: 'main',
              output: targetOutput,
              trigger: codepipeline_actions.CodeCommitTrigger.NONE,
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
              extraInputs: [targetOutput],
            }),
          ],
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'SourceRepoCloneUrl', {
      value: sourceRepo.repositoryCloneUrlGrc,
      description: 'Source repo clone URL (GRC)',
    });

    new cdk.CfnOutput(this, 'TargetRepoCloneUrl', {
      value: targetRepo.repositoryCloneUrlGrc,
      description: 'Target repo clone URL (GRC)',
    });

    new cdk.CfnOutput(this, 'PipelineName', {
      value: pipeline.pipelineName,
      description: 'CodePipeline name',
    });
  }
}
