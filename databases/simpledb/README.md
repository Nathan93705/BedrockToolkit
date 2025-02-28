# SimpleDB 
SimpleDB is a lightweight database that uses dynamic properties for data storage. It offers essential features designed for simplicity and efficiency, making it ideal for addons that don't require complex operations.

## Example Usages
```ts
import { SimpleDB } from "./SimpleDB";

const db = new SimpleDB("users");

db.set("user:Nathan93705", { name: "Nathan", age: 3 });
db.set("user:Bob", { name: "Bob", age: 4 });

const user = db.get("user:Nathan93705");
console.log(user);
```
