// cloudblob.auth.on('userChange', () => {
//   // redirect the user to login page

// })

// send the JWT token with each request.
// add JWT auth check middleware for any entity updates.


// auth.canPerformAction(entityPath, user)

// canPerformAction = (key, user) => {
//   return this.checkPathWhitelist(key, user).then(res => {
//     // this key prefix is whitelisted for a user to access, check specific permissions
//     const entityInfo = store.info(key)

//     entityInfo.rolesMask && user.roles

//   }).catch(err => err)
// }


// // Assign roles to users.

// // [0,1,1,0,1]