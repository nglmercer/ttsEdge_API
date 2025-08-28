import { DataStorage } from 'json-obj-manager';
import { JSONFileAdapter } from 'json-obj-manager/node';
import path from 'path';

// Define user identifier types
type UserIdentifier = {
    id: string;
    uniqueId: string;
}

// Define user display types
type UserDisplay = {
    nickname: string;
    displayName: string;
    username: string;
}

// Define message content types
type MessageContent = {
    comment: string;
    content: string;
    message: string;
    msg: string;
}

// Define your data type
interface Messages extends Partial<UserIdentifier>, Partial<UserDisplay>, Partial<MessageContent> {}

// Create storage with type safety
const messageStorage = new DataStorage<Messages>(
  new JSONFileAdapter(path.join(process.cwd(), 'messages.json'))
);
async function getAll() {
    return messageStorage.getAll();
}
async function getById(id: string) {
    const alldata = await getAll();
    return alldata[id]
}
async function save(data: Messages) {
    return messageStorage.save(data.id || crypto.randomUUID(), data);
}
async function deleteById(id: string) {
    return messageStorage.delete(id);
}
export {
    getAll,
    getById,
    save,
    deleteById
}