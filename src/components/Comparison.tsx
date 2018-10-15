import { faArrowAltCircleRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import ReactModal from "react-modal";
import { connect } from "react-redux";
import Select from "react-select";
import { ClipLoader } from "react-spinners";
import { isJiraTicketDone, jiraTicketHasFurtherCommits } from "src/jira/status";
import { findJiraTicket } from "src/store/helpers/find-ticket";
import { generateReleaseNotes } from "src/store/helpers/release-notes";
import styled from "styled-components";
import { Commit, CompareRefsResult } from "../github/loader";
import { HELPFUL_JIRA_ERROR_MESSAGE, jiraConfig } from "../jira/config";
import { JiraTicket } from "../jira/loader";
import {
  Dispatch,
  navigateToRefAction,
  toggleReleaseNotesAction
} from "../store/actions";
import {
  ComparisonState,
  CurrentRepoState,
  JiraTicketsState,
  Loadable,
  RefsState,
  State
} from "../store/state";
import Spinner from "./Spinner";

const Container = styled.div`
  flex-grow: 1;
  overflow-y: scroll;
`;

const Header = styled.div`
  display: flex;
  flex-direction: row;
`;

const SelectedBranch = styled.h2`
  margin: 0;
  padding: 12px;
  font-size: 1.2em;
`;

const CompareToBranch = styled.div`
  padding: 6px;
  flex-grow: 1;
`;

const ToggleReleaseNotesButton = styled.button`
  border-radius: 8px;
  margin: 8px 12px;
  outline: none;
  background: #fff;
  cursor: pointer;
  font-size: 0.9em;

  &&:hover {
    background: #f8f8f8;
  }
`;

const ReleaseNotes = styled.pre``;

const Description = styled.p`
  margin: 12px;
  margin-top: 0;
  padding: 8px;
  background: #fffbf6;
  box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  border: 1px solid #fb6;
  border-bottom-width: 2px;
`;

const CommitList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const CommitItem = styled.li`
  padding: 8px;
  background: #fff;
  display: flex;
  flex-direction: row;
  align-items: center;

  &&:nth-child(even) {
    background: #f8f8fc;
  }
`;

const CommitSha = styled.a`
  color: #aaa;
  text-decoration: none;
  font-family: "Roboto Mono", monospace;
  font-size: 0.9em;
  display: block;
  margin: 0 8px;
  user-select: none;

  &&:hover {
    color: #777;
    text-decoration: underline;
  }
`;

const CommitInfo = styled.div`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
`;

const CommitMessage = styled.div``;

const JiraTicket = styled.a<{ backgroundColor: string; loading?: boolean }>`
  user-select: none;
  background: ${props => props.backgroundColor};
  color: #333;
  margin: 0 8px;
  padding: 4px 20px;
  border-radius: 8px;
  text-decoration: none;
`;

const Author = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  user-select: none;
`;

const AuthorName = styled.span`
  color: #468;
`;

const AuthorAvatar = styled.img`
  width: 40px;
  height: 40px;
  border-radius: 8px;
  margin-left: 8px;
`;

class Comparison extends React.Component<{
  currentRepo: CurrentRepoState;
  refs: Loadable<RefsState>;
  selectedRefName: string;
  comparison: ComparisonState;
  compareToAnotherRef(
    currentRepo: CurrentRepoState,
    selectedRefName: string,
    compareToRefName: string
  ): void;
  toggleReleaseNotes(): void;
}> {
  public render() {
    const options =
      this.props.refs.status === "loaded"
        ? this.props.refs.loaded.refs
            .filter(r => r.name !== this.props.selectedRefName)
            .map(r => ({
              value: r.name,
              label: r.name
            }))
        : [];
    if (options.length === 0) {
      return <Container />;
    }
    return (
      <Container>
        <Header>
          <SelectedBranch>
            Comparing {this.props.selectedRefName} to{" "}
          </SelectedBranch>
          <CompareToBranch>
            <Select
              options={options}
              isOptionSelected={option =>
                option.value === this.props.comparison.compareToRefName
              }
              value={options.find(
                o => o.value === this.props.comparison.compareToRefName
              )}
              onChange={option =>
                option &&
                !(option instanceof Array) &&
                this.props.compareToAnotherRef(
                  this.props.currentRepo,
                  this.props.selectedRefName,
                  option.value
                )
              }
            />
          </CompareToBranch>
          {this.props.comparison.status === "loaded" && (
            <ToggleReleaseNotesButton onClick={this.props.toggleReleaseNotes}>
              {this.props.comparison.loaded.showReleaseNotes
                ? "Hide release notes"
                : "Show release notes"}
            </ToggleReleaseNotesButton>
          )}
        </Header>
        {this.props.comparison.status === "loaded" && (
          <>
            <ReactModal
              isOpen={this.props.comparison.loaded.showReleaseNotes}
              shouldCloseOnEsc={true}
              shouldCloseOnOverlayClick={true}
              onRequestClose={this.props.toggleReleaseNotes}
              ariaHideApp={false}
            >
              <ReleaseNotes>
                {generateReleaseNotes(this.props.comparison)}
              </ReleaseNotes>
            </ReactModal>
            <Description>
              {this.props.comparison.loaded.result.aheadBy} commits added.
              <br />
              {this.props.comparison.loaded.result.behindBy} commits removed.
              {this.props.comparison.loaded.result.hadToOmitCommits && (
                <>
                  <br />
                  <br />
                  <b>
                    Only showing a subset of commits because of limitations in
                    GitHub API.
                  </b>
                </>
              )}
            </Description>
            <CommitList>
              {this.renderComparisonList(
                this.props.comparison.loaded.result,
                this.props.comparison.loaded.jiraTickets
              )}
            </CommitList>
          </>
        )}
        {this.props.comparison.status === "loading" && Spinner}
      </Container>
    );
  }

  private renderComparisonList(
    comparison: CompareRefsResult,
    jiraTickets: Loadable<JiraTicketsState>
  ) {
    return (
      <>
        {comparison.addedCommits.map(commit => (
          <CommitItem key={commit.sha}>
            <FontAwesomeIcon icon={faArrowAltCircleRight} color="green" />
            {commitSha(commit)}
            {commitInfo(commit.commit.message)}
            {jiraTicketForCommit(comparison.addedCommits, commit, jiraTickets)}
            {author(commit)}
          </CommitItem>
        ))}
        {comparison.removedCommits.map(commit => (
          <CommitItem key={commit.sha}>
            <FontAwesomeIcon icon={faArrowAltCircleRight} color="red" />
            {commitSha(commit)}
            {commitInfo(commit.commit.message)}
            {author(commit)}
          </CommitItem>
        ))}
      </>
    );
  }
}

function commitInfo(commitMessage: string) {
  return (
    <CommitInfo>
      <CommitMessage>{commitMessage.split("\n", 2)[0]}</CommitMessage>
    </CommitInfo>
  );
}

function commitSha(commit: Commit) {
  return (
    <>
      {" "}
      <CommitSha target="_blank" href={commit.html_url}>
        {commit.sha.substr(0, 7)}
      </CommitSha>{" "}
    </>
  );
}

function author(commit: Commit) {
  return (
    <Author>
      <AuthorName>{commit.commit.author.name}</AuthorName>
      {commit.author && <AuthorAvatar src={commit.author.avatar_url} />}
    </Author>
  );
}

function jiraTicketForCommit(
  allCommits: Commit[],
  commit: Commit,
  jiraTicketsState: Loadable<JiraTicketsState>
) {
  const loadableJiraTicket = findJiraTicket(commit, jiraTicketsState);
  if (loadableJiraTicket === null) {
    return <></>;
  }
  if (loadableJiraTicket.status !== "loaded") {
    return (
      <JiraTicket
        href={jiraLink(loadableJiraTicket.key)}
        target="_blank"
        backgroundColor="#eee"
        loading={true}
      >
        {loadableJiraTicket.key} <ClipLoader size={12} />
      </JiraTicket>
    );
  }
  const jiraTicket = loadableJiraTicket.loaded;
  const jiraStatus = jiraTicket.status.name;
  const ticketIsNowDone = isJiraTicketDone(jiraTicket);
  const hasFurtherCommits = jiraTicketHasFurtherCommits(jiraTicket, allCommits);
  return (
    <JiraTicket
      href={jiraLink(jiraTicket.key)}
      target="_blank"
      backgroundColor={ticketIsNowDone && !hasFurtherCommits ? "#2b2" : "#ccc"}
    >
      {jiraTicket.key} - {jiraStatus}
      {ticketIsNowDone && !hasFurtherCommits && " ✓ "}{" "}
      {hasFurtherCommits && " (more commits)"}
    </JiraTicket>
  );
}

function jiraLink(jiraKey: string) {
  if (!jiraConfig) {
    throw new Error(HELPFUL_JIRA_ERROR_MESSAGE);
  }
  return `${jiraConfig.JIRA_HOST}/browse/${jiraKey}`;
}

const mapStateToProps = (state: State) => {
  if (
    !state.currentRepo ||
    !state.currentRepo.selectedRefName ||
    !state.currentRepo.comparison
  ) {
    throw new Error(`Invalid state`);
  }
  return {
    currentRepo: state.currentRepo,
    refs: state.currentRepo.refs,
    selectedRefName: state.currentRepo.selectedRefName,
    comparison: state.currentRepo.comparison
  };
};

const mapDispatchToProps = (dispatch: Dispatch) => ({
  compareToAnotherRef: (
    currentRepo: CurrentRepoState,
    selectedRefName: string,
    compareToRefName: string
  ) =>
    dispatch(
      navigateToRefAction(
        currentRepo.owner,
        currentRepo.repo,
        selectedRefName,
        compareToRefName
      )
    ),
  toggleReleaseNotes: () => dispatch(toggleReleaseNotesAction())
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Comparison);
