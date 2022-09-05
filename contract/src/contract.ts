import {
  NearBindgen,
  NearContract,
  near,
  call,
  view,
  Vector,
  UnorderedMap,
  assert,
} from "near-sdk-js";
import { Categories, CitizenComplaint, Statuses } from "./models";

const MAX_DESCRIPTION_LENGTH: number = 233;
const MAX_COMPLAINTS: number = 5;

BigInt.prototype["toJSON"] = function () {
  return this.toString();
};

// The @NearBindgen decorator allows this code to compile to Base64.
@NearBindgen
export class Contract extends NearContract {
  private complaints: Vector = new Vector("complaint");
  private userComplaints: UnorderedMap = new UnorderedMap("users");

  constructor() {
    //execute the NEAR Contract's constructor
    super();
  }

  default() {
    return new Contract();
  }

  /**
   *  CALL FUNCTIONS
   */

  @call
  addNewComplaint({
    title,
    description,
    category,
    location,
  }: {
    title: string;
    description: string;
    category: Categories;
    location: string;
  }): void {
    assert(title.length > 0, "the title is required");
    assert(
      description.length > 0 && description.length < MAX_DESCRIPTION_LENGTH,
      "description lenght is invalid"
    );

    //this key will be stored on the this.userComplaints map
    const key = `${near.signerAccountId()}u`;
    let numberOfComplaints = 0;

    //check if the user has some complaints already
    if (this.userComplaints.keys.toArray().includes(key)) {
      //if haves let see if he reach the max complaints
      assert(
        this.userComplaints.get(key) <= MAX_COMPLAINTS,
        "you reached the maximum amount of complaint"
      );
      numberOfComplaints = this.userComplaints.get(key) as number;
    }

    this.complaints.push(
      new CitizenComplaint(
        title,
        description,
        category,
        location,
        near.signerAccountId() + this.complaints.len(),
        Number(near.blockTimestamp()),
        this.complaints.length,
        BigInt(Number(near.attachedDeposit()))
      )
    );

    this.userComplaints.set(key, numberOfComplaints + 1);
  }

  @call
  voteComplaint({ id }: { id: number }): CitizenComplaint {
    assert(id >= 0, "we dont have negative this.complaints");
    assert(id < this.complaints.len(), "we dont have that complaint");

    const existing = this.complaints.get(id);
    near.log("logging in contract", existing);
    const complaint = CitizenComplaint.from(
      this.complaints.get(id) as CitizenComplaint
    );
    const key = `${near.signerAccountId()}${id}`;

    // assert(!complaint.votes.keys.toArray().includes(key), " already voted");
    assert(
      complaint.status != Statuses.done,
      "this complaint is already done broh"
    );

    complaint.balance += BigInt(Number(near.attachedDeposit()));
    complaint.voteCount += 1;
    complaint.votes.set(key, true);
    this.complaints.replace(id, complaint);

    return complaint;
  }

  @call
  removeVote({ id }: { id: number }): CitizenComplaint {
    assert(id >= 0, "we dont have negative this.complaints");
    assert(!this.complaints.isEmpty(), "there are not this.complaints");
    assert(id <= this.complaints.len() - 1, "we dont have that complaint");

    const complaint = this.complaints.get(id) as CitizenComplaint;
    const key = `${near.signerAccountId()}${id}`;

    assert(
      complaint.ticketOwner !== key,
      "sorry the owner the ticker cant unvote"
    );
    assert(
      complaint.votes.keys.toArray().includes(key),
      "you haven't voted this complaint"
    );
    assert(
      complaint.status !== Statuses.done,
      "this complaint is already done broh"
    );

    complaint.voteCount -= 1;
    complaint.votes.remove(key);
    this.complaints.replace(id, complaint);

    return complaint;
  }

  /**
 * 


 donate(id:number):CitizenComplaint{

    let complaint  = this.complaints[id]

  assert(complaint.status!= Statuses.done,"this complaint is alreadt done")
  assert(id>=0 ,"we dont have negative this.complaints")
  assert(id<= (complaints.length-1),"we dont have that complaint")
  assert(!complaints.isEmpty,"there are not this.complaints")
  assert(id<= (complaints.length-1),"we dont have that complaint")
  assert(u128.gt(near.attachedDeposit,u128.Zero),"sorry you dont send funds broh")
  complaint.balance=u128.add(complaint.balance , near.attachedDeposit)
  this.complaints.replace(<number>id, complaint)
   return complaint

}
 */

  @call
  takeComplaint({ id }: { id: number }): CitizenComplaint {
    assert(id >= 0, "we dont have negative this.complaints");
    assert(!this.complaints.isEmpty(), "there are not this.complaints");
    assert(id < this.complaints.len(), "we dont have that complaint");

    const complaint = this.complaints.get(id) as CitizenComplaint;
    const key = `${near.signerAccountId()}${id}`;

    assert(complaint.solver === "", "sorry this complaint it's taken");
    assert(
      complaint.status !== Statuses.done,
      "this complaint is already done broh"
    );
    assert(
      complaint.ticketOwner !== key,
      "sorry the owner  cant be the solver"
    );

    this.complaints.replace(id, {
      ...complaint,
      status: Statuses.inProgess,
      solver: near.signerAccountId(),
    });

    return complaint;
  }

  @call
  finishComplaint({ id }: { id: number }): CitizenComplaint {
    const complaint = this.complaints.get(id) as CitizenComplaint;
    const key = `${near.signerAccountId()}${id}`;

    assert(
      key === complaint.ticketOwner,
      "sorry only the ticket owner can mark the complaint as done"
    );
    assert(complaint.solver.length > 0, " there is not assigned any solver");
    assert(
      complaint.status !== Statuses.done,
      "this complaint is already done broh"
    );

    this.complaints.replace(id, { ...complaint, status: Statuses.done });

    const complaintSolver = near.promiseBatchCreate(complaint.solver);
    near.promiseBatchActionTransfer(complaintSolver, complaint.balance);
    near.promiseReturn(complaintSolver);

    return complaint;
  }

  /**
   *  VIEW FUNCTIONS
   */

  @view
  getComplaints(): Array<CitizenComplaint> {
    return this.complaints.toArray() as Array<CitizenComplaint>;
  }

  @view
  getComplaintInfo(id: number): CitizenComplaint {
    assert(this.complaints.length > 0, "we dont have any this.complaints");
    assert(id >= 0, "we dont have negative this.complaints");
    assert(id <= this.complaints.length - 1, "we dont have that complaint");

    return this.complaints.get(id) as CitizenComplaint;
  }

  @view
  getNComplaints(): number {
    return this.complaints.len();
  }

  @view
  getNumberOfComplaints(): number {
    const key = near.signerAccountId() + "u";

    return (this.userComplaints.get(key) as number) || 0;
  }
}
