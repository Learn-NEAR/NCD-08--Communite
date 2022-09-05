import { near, UnorderedMap } from "near-sdk-js";

/**
 * all avaivables problems
 * @todo add more categories
 */
export enum Categories {
  Lights,
  Street,
  Neighborhood,
  Water_Problems,
}

/**
 * status of each of the tickets
 */
export enum Statuses {
  done,
  inProgess,
  submited,
}

/**
 * represent the location of the problem
 */

/*export interface Loc {
  lon: string;
  lat: string;
}*/

/**
 * represent the problem to be solved
 */
export class CitizenComplaint {
  status: Statuses;
  votes: UnorderedMap;
  solver: string;
  voteCount: number;

  /**
   *
   * @param title how it will displayed
   * @param category what topic the ticket is
   * @param location where is the problem
   * @param ticketOwner who send the ticket
   */
  constructor(
    public title: string,
    public description: string,
    public category: Categories,
    public location: string,
    public ticketOwner: string,
    public timestamp: number,
    public id: number,
    public balance: bigint
  ) {
    this.votes = new UnorderedMap("v");
    this.votes.set(ticketOwner, true);
    this.voteCount = 1;
    this.solver = "";
    this.status = Statuses.submited;
  }

  /**
   * only who already voted can revert it
   * @param voter string accountid
   */
  removeVote(voter: string): void {
    if ((this.votes.get(voter) || false) && this.ticketOwner != voter) {
      this.votes.set(voter, false);
      this.voteCount -= 1;
    }
  }

  /**
   * @todo restrict who can be solver
   * @param voter the guy  assigned to solve this ticket
   */
  changeStatusToInProgress(voter: string): void {
    if (this.ticketOwner != voter && this.status != Statuses.done) {
      this.solver = voter;
      this.status = Statuses.inProgess;
    }
  }

  /**
   * @todo add capabillity in order the solver can  request the finalization of a ticket
   * @param voter in this implementation it can be just the guy who submitted the ticket
   */
  changeStatusToDone(voter: string): void {
    if (this.ticketOwner == voter && this.status != Statuses.done) {
      this.status = Statuses.done;
    }
  }

  static from({
    id,
    ticketOwner,
    title,
    timestamp,
    category,
    votes,
    voteCount,
    solver,
    status,
    location,
    description,
    balance,
  }: CitizenComplaint): CitizenComplaint {
    const complaint = new CitizenComplaint(
      title,
      description,
      category,
      location,
      ticketOwner,
      timestamp,
      id,
      balance
    );

    complaint.votes = new UnorderedMap("v");
    // complaint.votes.
    complaint.voteCount = voteCount;
    complaint.solver = solver;
    complaint.status = status;

    near.log("logging votes", votes);

    return complaint;
  }
}
