function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) {
  var desc = {};
  Object.keys(descriptor).forEach(function (key) {
    desc[key] = descriptor[key];
  });
  desc.enumerable = !!desc.enumerable;
  desc.configurable = !!desc.configurable;

  if ('value' in desc || desc.initializer) {
    desc.writable = true;
  }

  desc = decorators.slice().reverse().reduce(function (desc, decorator) {
    return decorator(target, property, desc) || desc;
  }, desc);

  if (context && desc.initializer !== void 0) {
    desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
    desc.initializer = undefined;
  }

  if (desc.initializer === void 0) {
    Object.defineProperty(target, property, desc);
    desc = null;
  }

  return desc;
}

function call(target, key, descriptor) {}
function view(target, key, descriptor) {}
function NearBindgen(target) {
  return class extends target {
    static _init() {
      // @ts-ignore
      let args = target.deserializeArgs();
      let ret = new target(args); // @ts-ignore

      ret.init(); // @ts-ignore

      ret.serialize();
      return ret;
    }

    static _get() {
      let ret = Object.create(target.prototype);
      return ret;
    }

  };
}

const U64_MAX = 2n ** 64n - 1n;
const EVICTED_REGISTER = U64_MAX - 1n;
function log(...params) {
  env.log(`${params.map(x => x === undefined ? 'undefined' : x) // Stringify undefined
  .map(x => typeof x === 'object' ? JSON.stringify(x) : x) // Convert Objects to strings
  .join(' ')}` // Convert to string
  );
}
function signerAccountId() {
  env.signer_account_id(0);
  return env.read_register(0);
}
function blockTimestamp() {
  return env.block_timestamp();
}
function attachedDeposit() {
  return env.attached_deposit();
}
function storageRead(key) {
  let ret = env.storage_read(key, 0);

  if (ret === 1n) {
    return env.read_register(0);
  } else {
    return null;
  }
}
function storageGetEvicted() {
  return env.read_register(EVICTED_REGISTER);
}
function input() {
  env.input(0);
  return env.read_register(0);
}
function promiseBatchCreate(accountId) {
  return env.promise_batch_create(accountId);
}
function promiseBatchActionTransfer(promiseIndex, amount) {
  env.promise_batch_action_transfer(promiseIndex, amount);
}
var PromiseResult;

(function (PromiseResult) {
  PromiseResult[PromiseResult["NotReady"] = 0] = "NotReady";
  PromiseResult[PromiseResult["Successful"] = 1] = "Successful";
  PromiseResult[PromiseResult["Failed"] = 2] = "Failed";
})(PromiseResult || (PromiseResult = {}));
function promiseReturn(promiseIdx) {
  env.promise_return(promiseIdx);
}
function storageWrite(key, value) {
  let exist = env.storage_write(key, value, EVICTED_REGISTER);

  if (exist === 1n) {
    return true;
  }

  return false;
}
function storageRemove(key) {
  let exist = env.storage_remove(key, EVICTED_REGISTER);

  if (exist === 1n) {
    return true;
  }

  return false;
}

class NearContract {
  deserialize() {
    const rawState = storageRead("STATE");

    if (rawState) {
      const state = JSON.parse(rawState); // reconstruction of the contract class object from plain object

      let c = this.default();
      Object.assign(this, state);

      for (const item in c) {
        if (c[item].constructor?.deserialize !== undefined) {
          this[item] = c[item].constructor.deserialize(this[item]);
        }
      }
    } else {
      throw new Error("Contract state is empty");
    }
  }

  serialize() {
    storageWrite("STATE", JSON.stringify(this));
  }

  static deserializeArgs() {
    let args = input();
    return JSON.parse(args || "{}");
  }

  static serializeReturn(ret) {
    return JSON.stringify(ret);
  }

  init() {}

}

function u8ArrayToBytes(array) {
  let ret = "";

  for (let e of array) {
    ret += String.fromCharCode(e);
  }

  return ret;
} // TODO this function is a bit broken and the type can't be string
// TODO for more info: https://github.com/near/near-sdk-js/issues/78

function bytesToU8Array(bytes) {
  let ret = new Uint8Array(bytes.length);

  for (let i = 0; i < bytes.length; i++) {
    ret[i] = bytes.charCodeAt(i);
  }

  return ret;
}

function assert(b, str) {
  if (b) {
    return;
  } else {
    throw Error("assertion failed: " + str);
  }
}

const ERR_INDEX_OUT_OF_BOUNDS = "Index out of bounds";
const ERR_INCONSISTENT_STATE$1 = "The collection is an inconsistent state. Did previous smart contract execution terminate unexpectedly?";

function indexToKey(prefix, index) {
  let data = new Uint32Array([index]);
  let array = new Uint8Array(data.buffer);
  let key = u8ArrayToBytes(array);
  return prefix + key;
} /// An iterable implementation of vector that stores its content on the trie.
/// Uses the following map: index -> element


class Vector {
  constructor(prefix) {
    this.length = 0;
    this.prefix = prefix;
  }

  len() {
    return this.length;
  }

  isEmpty() {
    return this.length == 0;
  }

  get(index) {
    if (index >= this.length) {
      return null;
    }

    let storageKey = indexToKey(this.prefix, index);
    return JSON.parse(storageRead(storageKey));
  } /// Removes an element from the vector and returns it in serialized form.
  /// The removed element is replaced by the last element of the vector.
  /// Does not preserve ordering, but is `O(1)`.


  swapRemove(index) {
    if (index >= this.length) {
      throw new Error(ERR_INDEX_OUT_OF_BOUNDS);
    } else if (index + 1 == this.length) {
      return this.pop();
    } else {
      let key = indexToKey(this.prefix, index);
      let last = this.pop();

      if (storageWrite(key, JSON.stringify(last))) {
        return JSON.parse(storageGetEvicted());
      } else {
        throw new Error(ERR_INCONSISTENT_STATE$1);
      }
    }
  }

  push(element) {
    let key = indexToKey(this.prefix, this.length);
    this.length += 1;
    storageWrite(key, JSON.stringify(element));
  }

  pop() {
    if (this.isEmpty()) {
      return null;
    } else {
      let lastIndex = this.length - 1;
      let lastKey = indexToKey(this.prefix, lastIndex);
      this.length -= 1;

      if (storageRemove(lastKey)) {
        return JSON.parse(storageGetEvicted());
      } else {
        throw new Error(ERR_INCONSISTENT_STATE$1);
      }
    }
  }

  replace(index, element) {
    if (index >= this.length) {
      throw new Error(ERR_INDEX_OUT_OF_BOUNDS);
    } else {
      let key = indexToKey(this.prefix, index);

      if (storageWrite(key, JSON.stringify(element))) {
        return JSON.parse(storageGetEvicted());
      } else {
        throw new Error(ERR_INCONSISTENT_STATE$1);
      }
    }
  }

  extend(elements) {
    for (let element of elements) {
      this.push(element);
    }
  }

  [Symbol.iterator]() {
    return new VectorIterator(this);
  }

  clear() {
    for (let i = 0; i < this.length; i++) {
      let key = indexToKey(this.prefix, i);
      storageRemove(key);
    }

    this.length = 0;
  }

  toArray() {
    let ret = [];

    for (let v of this) {
      ret.push(v);
    }

    return ret;
  }

  serialize() {
    return JSON.stringify(this);
  } // converting plain object to class object


  static deserialize(data) {
    let vector = new Vector(data.prefix);
    vector.length = data.length;
    return vector;
  }

}
class VectorIterator {
  constructor(vector) {
    this.current = 0;
    this.vector = vector;
  }

  next() {
    if (this.current < this.vector.len()) {
      let value = this.vector.get(this.current);
      this.current += 1;
      return {
        value,
        done: false
      };
    }

    return {
      value: null,
      done: true
    };
  }

}

const ERR_INCONSISTENT_STATE = "The collection is an inconsistent state. Did previous smart contract execution terminate unexpectedly?";
class UnorderedMap {
  constructor(prefix) {
    this.length = 0;
    this.prefix = prefix;
    this.keyIndexPrefix = prefix + "i";
    let indexKey = prefix + "k";
    let indexValue = prefix + "v";
    this.keys = new Vector(indexKey);
    this.values = new Vector(indexValue);
  }

  len() {
    let keysLen = this.keys.len();
    let valuesLen = this.values.len();

    if (keysLen != valuesLen) {
      throw new Error(ERR_INCONSISTENT_STATE);
    }

    return keysLen;
  }

  isEmpty() {
    let keysIsEmpty = this.keys.isEmpty();
    let valuesIsEmpty = this.values.isEmpty();

    if (keysIsEmpty != valuesIsEmpty) {
      throw new Error(ERR_INCONSISTENT_STATE);
    }

    return keysIsEmpty;
  }

  serializeIndex(index) {
    let data = new Uint32Array([index]);
    let array = new Uint8Array(data.buffer);
    return u8ArrayToBytes(array);
  }

  deserializeIndex(rawIndex) {
    let array = bytesToU8Array(rawIndex);
    let data = new Uint32Array(array.buffer);
    return data[0];
  }

  getIndexRaw(key) {
    let indexLookup = this.keyIndexPrefix + JSON.stringify(key);
    let indexRaw = storageRead(indexLookup);
    return indexRaw;
  }

  get(key) {
    let indexRaw = this.getIndexRaw(key);

    if (indexRaw) {
      let index = this.deserializeIndex(indexRaw);
      let value = this.values.get(index);

      if (value) {
        return value;
      } else {
        throw new Error(ERR_INCONSISTENT_STATE);
      }
    }

    return null;
  }

  set(key, value) {
    let indexLookup = this.keyIndexPrefix + JSON.stringify(key);
    let indexRaw = storageRead(indexLookup);

    if (indexRaw) {
      let index = this.deserializeIndex(indexRaw);
      return this.values.replace(index, value);
    } else {
      let nextIndex = this.len();
      let nextIndexRaw = this.serializeIndex(nextIndex);
      storageWrite(indexLookup, nextIndexRaw);
      this.keys.push(key);
      this.values.push(value);
      return null;
    }
  }

  remove(key) {
    let indexLookup = this.keyIndexPrefix + JSON.stringify(key);
    let indexRaw = storageRead(indexLookup);

    if (indexRaw) {
      if (this.len() == 1) {
        // If there is only one element then swap remove simply removes it without
        // swapping with the last element.
        storageRemove(indexLookup);
      } else {
        // If there is more than one element then swap remove swaps it with the last
        // element.
        let lastKey = this.keys.get(this.len() - 1);

        if (!lastKey) {
          throw new Error(ERR_INCONSISTENT_STATE);
        }

        storageRemove(indexLookup); // If the removed element was the last element from keys, then we don't need to
        // reinsert the lookup back.

        if (lastKey != key) {
          let lastLookupKey = this.keyIndexPrefix + JSON.stringify(lastKey);
          storageWrite(lastLookupKey, indexRaw);
        }
      }

      let index = this.deserializeIndex(indexRaw);
      this.keys.swapRemove(index);
      return this.values.swapRemove(index);
    }

    return null;
  }

  clear() {
    for (let key of this.keys) {
      let indexLookup = this.keyIndexPrefix + JSON.stringify(key);
      storageRemove(indexLookup);
    }

    this.keys.clear();
    this.values.clear();
  }

  toArray() {
    let ret = [];

    for (let v of this) {
      ret.push(v);
    }

    return ret;
  }

  [Symbol.iterator]() {
    return new UnorderedMapIterator(this);
  }

  extend(kvs) {
    for (let [k, v] of kvs) {
      this.set(k, v);
    }
  }

  serialize() {
    return JSON.stringify(this);
  } // converting plain object to class object


  static deserialize(data) {
    let map = new UnorderedMap(data.prefix); // reconstruct UnorderedMap

    map.length = data.length; // reconstruct keys Vector

    map.keys = new Vector(data.prefix + "k");
    map.keys.length = data.keys.length; // reconstruct values Vector

    map.values = new Vector(data.prefix + "v");
    map.values.length = data.values.length;
    return map;
  }

}

class UnorderedMapIterator {
  constructor(unorderedMap) {
    this.keys = new VectorIterator(unorderedMap.keys);
    this.values = new VectorIterator(unorderedMap.values);
  }

  next() {
    let key = this.keys.next();
    let value = this.values.next();

    if (key.done != value.done) {
      throw new Error(ERR_INCONSISTENT_STATE);
    }

    return {
      value: [key.value, value.value],
      done: key.done
    };
  }

}

/**
 * all avaivables problems
 * @todo add more categories
 */

let Categories;
/**
 * status of each of the tickets
 */

(function (Categories) {
  Categories[Categories["Lights"] = 0] = "Lights";
  Categories[Categories["Street"] = 1] = "Street";
  Categories[Categories["Neighborhood"] = 2] = "Neighborhood";
  Categories[Categories["Water_Problems"] = 3] = "Water_Problems";
})(Categories || (Categories = {}));

let Statuses;
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

(function (Statuses) {
  Statuses[Statuses["done"] = 0] = "done";
  Statuses[Statuses["inProgess"] = 1] = "inProgess";
  Statuses[Statuses["submited"] = 2] = "submited";
})(Statuses || (Statuses = {}));

class CitizenComplaint {
  /**
   *
   * @param title how it will displayed
   * @param category what topic the ticket is
   * @param location where is the problem
   * @param ticketOwner who send the ticket
   */
  constructor(title, description, category, location, ticketOwner, timestamp, id, balance) {
    this.title = title;
    this.description = description;
    this.category = category;
    this.location = location;
    this.ticketOwner = ticketOwner;
    this.timestamp = timestamp;
    this.id = id;
    this.balance = balance;
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


  removeVote(voter) {
    if ((this.votes.get(voter) || false) && this.ticketOwner != voter) {
      this.votes.set(voter, false);
      this.voteCount -= 1;
    }
  }
  /**
   * @todo restrict who can be solver
   * @param voter the guy  assigned to solve this ticket
   */


  changeStatusToInProgress(voter) {
    if (this.ticketOwner != voter && this.status != Statuses.done) {
      this.solver = voter;
      this.status = Statuses.inProgess;
    }
  }
  /**
   * @todo add capabillity in order the solver can  request the finalization of a ticket
   * @param voter in this implementation it can be just the guy who submitted the ticket
   */


  changeStatusToDone(voter) {
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
    balance
  }) {
    const complaint = new CitizenComplaint(title, description, category, location, ticketOwner, timestamp, id, balance);
    complaint.votes = new UnorderedMap("v");
    complaint.voteCount = voteCount;
    complaint.solver = solver;
    complaint.status = status;
    log("logging votes", votes);
    return complaint;
  }

}

var _class, _class2;
const MAX_DESCRIPTION_LENGTH = 233;
const MAX_COMPLAINTS = 5;

BigInt.prototype["toJSON"] = function () {
  return this.toString();
}; // The @NearBindgen decorator allows this code to compile to Base64.


let Contract = NearBindgen(_class = (_class2 = class Contract extends NearContract {
  complaints = new Vector("complaint");
  userComplaints = new UnorderedMap("users");

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


  addNewComplaint({
    title,
    description,
    category,
    location
  }) {
    assert(title.length > 0, "the title is required");
    assert(description.length > 0 && description.length < MAX_DESCRIPTION_LENGTH, "description lenght is invalid"); //this key will be stored on the this.userComplaints map

    const key = `${signerAccountId()}u`;
    let numberOfComplaints = 0; //check if the user has some complaints already

    if (this.userComplaints.keys.toArray().includes(key)) {
      //if haves let see if he reach the max complaints
      assert(this.userComplaints.get(key) <= MAX_COMPLAINTS, "you reached the maximum amount of complaint");
      numberOfComplaints = this.userComplaints.get(key);
    }

    this.complaints.push(new CitizenComplaint(title, description, category, location, signerAccountId() + this.complaints.len(), Number(blockTimestamp()), this.complaints.length, BigInt(Number(attachedDeposit()))));
    this.userComplaints.set(key, numberOfComplaints + 1);
  }

  voteComplaint({
    id
  }) {
    assert(id >= 0, "we dont have negative this.complaints");
    assert(id < this.complaints.len(), "we dont have that complaint");
    const existing = this.complaints.get(id);
    log("logging in contract", existing);
    const complaint = CitizenComplaint.from(this.complaints.get(id));
    const key = `${signerAccountId()}${id}`; // assert(!complaint.votes.keys.toArray().includes(key), " already voted");

    assert(complaint.status != Statuses.done, "this complaint is already done broh");
    complaint.balance += BigInt(Number(attachedDeposit()));
    complaint.voteCount += 1;
    complaint.votes.set(key, true);
    this.complaints.replace(id, complaint);
    return complaint;
  }

  removeVote({
    id
  }) {
    assert(id >= 0, "we dont have negative this.complaints");
    assert(!this.complaints.isEmpty(), "there are not this.complaints");
    assert(id <= this.complaints.len() - 1, "we dont have that complaint");
    const complaint = this.complaints.get(id);
    const key = `${signerAccountId()}${id}`;
    assert(complaint.ticketOwner !== key, "sorry the owner the ticker cant unvote");
    assert(complaint.votes.keys.toArray().includes(key), "you haven't voted this complaint");
    assert(complaint.status !== Statuses.done, "this complaint is already done broh");
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


  takeComplaint({
    id
  }) {
    assert(id >= 0, "we dont have negative this.complaints");
    assert(!this.complaints.isEmpty(), "there are not this.complaints");
    assert(id < this.complaints.len(), "we dont have that complaint");
    const complaint = this.complaints.get(id);
    const key = `${signerAccountId()}${id}`;
    assert(complaint.solver === "", "sorry this complaint it's taken");
    assert(complaint.status !== Statuses.done, "this complaint is already done broh");
    assert(complaint.ticketOwner !== key, "sorry the owner  cant be the solver");
    this.complaints.replace(id, { ...complaint,
      status: Statuses.inProgess,
      solver: signerAccountId()
    });
    return complaint;
  }

  finishComplaint({
    id
  }) {
    const complaint = this.complaints.get(id);
    const key = `${signerAccountId()}${id}`;
    assert(key === complaint.ticketOwner, "sorry only the ticket owner can mark the complaint as done");
    assert(complaint.solver.length > 0, " there is not assigned any solver");
    assert(complaint.status !== Statuses.done, "this complaint is already done broh");
    this.complaints.replace(id, { ...complaint,
      status: Statuses.done
    });
    const complaintSolver = promiseBatchCreate(complaint.solver);
    promiseBatchActionTransfer(complaintSolver, complaint.balance);
    promiseReturn(complaintSolver);
    return complaint;
  }
  /**
   *  VIEW FUNCTIONS
   */


  getComplaints() {
    return this.complaints.toArray();
  }

  getComplaintInfo(id) {
    assert(this.complaints.length > 0, "we dont have any this.complaints");
    assert(id >= 0, "we dont have negative this.complaints");
    assert(id <= this.complaints.length - 1, "we dont have that complaint");
    return this.complaints.get(id);
  }

  getNComplaints() {
    return this.complaints.len();
  }

  getNumberOfComplaints() {
    const key = signerAccountId() + "u";
    return this.userComplaints.get(key) || 0;
  }

}, (_applyDecoratedDescriptor(_class2.prototype, "addNewComplaint", [call], Object.getOwnPropertyDescriptor(_class2.prototype, "addNewComplaint"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "voteComplaint", [call], Object.getOwnPropertyDescriptor(_class2.prototype, "voteComplaint"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "removeVote", [call], Object.getOwnPropertyDescriptor(_class2.prototype, "removeVote"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "takeComplaint", [call], Object.getOwnPropertyDescriptor(_class2.prototype, "takeComplaint"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "finishComplaint", [call], Object.getOwnPropertyDescriptor(_class2.prototype, "finishComplaint"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "getComplaints", [view], Object.getOwnPropertyDescriptor(_class2.prototype, "getComplaints"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "getComplaintInfo", [view], Object.getOwnPropertyDescriptor(_class2.prototype, "getComplaintInfo"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "getNComplaints", [view], Object.getOwnPropertyDescriptor(_class2.prototype, "getNComplaints"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "getNumberOfComplaints", [view], Object.getOwnPropertyDescriptor(_class2.prototype, "getNumberOfComplaints"), _class2.prototype)), _class2)) || _class;
function init() {
  Contract._init();
}
function getNumberOfComplaints() {
  let _contract = Contract._get();

  _contract.deserialize();

  let args = _contract.constructor.deserializeArgs();

  let ret = _contract.getNumberOfComplaints(args);
  if (ret !== undefined) env.value_return(_contract.constructor.serializeReturn(ret));
}
function getNComplaints() {
  let _contract = Contract._get();

  _contract.deserialize();

  let args = _contract.constructor.deserializeArgs();

  let ret = _contract.getNComplaints(args);
  if (ret !== undefined) env.value_return(_contract.constructor.serializeReturn(ret));
}
function getComplaintInfo() {
  let _contract = Contract._get();

  _contract.deserialize();

  let args = _contract.constructor.deserializeArgs();

  let ret = _contract.getComplaintInfo(args);
  if (ret !== undefined) env.value_return(_contract.constructor.serializeReturn(ret));
}
function getComplaints() {
  let _contract = Contract._get();

  _contract.deserialize();

  let args = _contract.constructor.deserializeArgs();

  let ret = _contract.getComplaints(args);
  if (ret !== undefined) env.value_return(_contract.constructor.serializeReturn(ret));
}
function finishComplaint() {
  let _contract = Contract._get();

  _contract.deserialize();

  let args = _contract.constructor.deserializeArgs();

  let ret = _contract.finishComplaint(args);

  _contract.serialize();

  if (ret !== undefined) env.value_return(_contract.constructor.serializeReturn(ret));
}
function takeComplaint() {
  let _contract = Contract._get();

  _contract.deserialize();

  let args = _contract.constructor.deserializeArgs();

  let ret = _contract.takeComplaint(args);

  _contract.serialize();

  if (ret !== undefined) env.value_return(_contract.constructor.serializeReturn(ret));
}
function removeVote() {
  let _contract = Contract._get();

  _contract.deserialize();

  let args = _contract.constructor.deserializeArgs();

  let ret = _contract.removeVote(args);

  _contract.serialize();

  if (ret !== undefined) env.value_return(_contract.constructor.serializeReturn(ret));
}
function voteComplaint() {
  let _contract = Contract._get();

  _contract.deserialize();

  let args = _contract.constructor.deserializeArgs();

  let ret = _contract.voteComplaint(args);

  _contract.serialize();

  if (ret !== undefined) env.value_return(_contract.constructor.serializeReturn(ret));
}
function addNewComplaint() {
  let _contract = Contract._get();

  _contract.deserialize();

  let args = _contract.constructor.deserializeArgs();

  let ret = _contract.addNewComplaint(args);

  _contract.serialize();

  if (ret !== undefined) env.value_return(_contract.constructor.serializeReturn(ret));
}

export { Contract, addNewComplaint, finishComplaint, getComplaintInfo, getComplaints, getNComplaints, getNumberOfComplaints, init, removeVote, takeComplaint, voteComplaint };
//# sourceMappingURL=hello_near.js.map
