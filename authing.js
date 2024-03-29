
var axios = require('axios')
var uuid = require('uuid/v4')
var s = require('smarts')()
var secrets = require('../secrets')
var admin = require("firebase-admin")
var serviceAccount = secrets.firebase
var {OAuth2Client} = require('google-auth-library')
var bcrypt = require('bcryptjs')
var alopugclient = new OAuth2Client(secrets.google.CLIENT_ID)
if(!admin.apps.length){
	admin.initializeApp({
		credential: admin.credential.cert(serviceAccount),
		databaseURL: secrets.google.firebaseUrl
	})
} else {
}
var db = admin.firestore()
db.settings({
	timestampsInSnapshots: true
})
/** template
module.exports.authHandler = ({credentials, token}) => {

}
*/

module.exports.facebook = module.exports.fb = (args) => {
	/** Will verify a facebook token and add a session token to the corresponding entity state
	 * @required @param @var args.token @type {Object} is a provider token to be verified
	 * @param @var args.entity @type {Object} is the native entity object
	 * the entity is looked up in either case, if no entity exists but the entity argument was passed, 
	 * the entity data will be saved with the newly created native entity
	 * if the entity already exists and the entity data provided does not match the linked native entity, 
	 * the local entity data will be backed up and replace by the native entity data
	 */
	return new Promise((resolve, reject)=>{
		var input_token = s.getsmart(args, 'token.authResponse.accessToken', false)
		if(args.token && input_token){
			var data = {
				input_token,
				access_token: secrets.facebookApp.id+'|'+secrets.facebookApp.secret
			}
			let headers = {
				// 'Content-Type': 'application/json;charset=UTF-8',
				"Access-Control-Allow-Origin": "*",
			}
			axios({
				url: 'https://graph.facebook.com/debug_token', 
				method: 'get',
				params: data, 
				headers
			})
			.then((res) => {
				var data = res.data.data
				if(data.is_valid && s.getsmart(args, 'token.authResponse.userID', false) === data.user_id && data.app_id === secrets.facebookApp.id){
					args.res = data
					args.success = true
					resolve(args)
				} else {
					console.error(`The ${args.provider} token was not valid`)
					reject({
						success: false,
						error: `The ${args.provider} token was not valid`
					})
				}
			})
			.catch((err) => {
				reject({
					success: false,
					error: [`There was an axios post error`, err]
				})
			})
		} else {
			reject({
				success: false, 
				error: "You didn't provide a valid token"
			})	
		}
	})
}

module.exports.google = module.exports.g = (args) => {
	/** Will verify a facebook token and add a session token to the corresponding entity state
	 * @required @param @var args.token @type {Object} is a provider token to be verified
	 * @param @var args.entity @type {Object} is the native entity object
	 * the entity is looked up in either case, if no entity exists but the entity argument was passed, 
	 * the entity data will be saved with the newly created native entity
	 * if the entity already exists and the entity data provided does not match the linked native entity, 
	 * the local entity data will be backed up and replace by the native entity data
	 */
	return new Promise((resolve, reject)=>{
		var id_token = s.getsmart(args, 'token.Zi.id_token', false)
		if(args.token && id_token){
			async function verify() {
				const ticket = await alopugclient.verifyIdToken({
						idToken: id_token,
						audience: secrets.google.CLIENT_ID,  // Specify the CLIENT_ID of the app that accesses the backend
						// Or, if multiple clients access the backend:
						//[CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
				});
				const payload = ticket.getPayload();
				return payload
				// const userid = payload['sub'];
				// If request specified a G Suite domain:
				//const domain = payload['hd'];
			}
			verify()
			.then((res) => {
				var data = res
				if(s.getsmart(args, 'token.w3.U3', false) === data.email){
					args.res = data
					args.success = true
					resolve(args)
				} else {
					console.error(`The ${args.provider} token was not valid`)
					reject({
						success: false,
						error: `The ${args.provider} token was not valid`
					})
				}
			})
			.catch((err) => {
				console.error(`The ${args.provider} token was not valid: `, err)
				reject({
					success: false,
					error: [`The ${args.provider} token was not valid`, err]
				})
			})
		} else {
			reject({
				success: false, 
				error: "You didn't provide a valid token"
			})	
		}
	})
}

module.exports.agora = module.exports.alopu = module.exports.planetexpress = module.exports.n = module.exports.a = (args) => {
	return new Promise((resolve, reject)=>{
		if(args.token){
			reject({
				success: false,
				error: "Alopu authentication currently doesn't support token validation"
			})			
		} else if(args.entity) {
			let things = db.collection(`${s.getsmart(global, 'env.level', 'dev')}/things/users`)
			let provider = this.provider(args)
			let providerIdString = this.providerIdString(args)
			let username = s.getsmart(args, 'entity.'+provider+'.'+providerIdString, false)
			let password = s.getsmart(args, 'entity.'+provider+'.password', false)
			// if(password){
			things = things.where(provider+'.'+providerIdString, '==', username)
			things.get()
			.then(res=>{
				if(res.size){
					let serverEntity = res.docs[0].data()
					let serverHash = s.getsmart(serverEntity, provider+'.password', false)
					if(serverHash && bcrypt.compareSync(password, serverHash)){
						args.success = true
						// s.setsmart(args, 'entity.'+provider+'.password', null)
						// password = null
						resolve(args)
					} else if (!serverHash && !password){
						args.success = true
						// s.setsmart(args, 'entity.'+provider+'.password', null)
						// password = null
						resolve(args)
					} else {
						let error = 'The password provided from the client did not match the server password'
						console.error(error)
						reject({
							success: false,
							error
						})
					}
				} else {
					/** we simply resolve if no entity was found because how can a non-existant password not be valid onto a given password */
					args.success = true
					resolve(args)
				}
			})
			.catch(err=>{
				console.error('something went wrong fetching a user for password authentication: ', err)
				reject(err)
			})
			// }
		} else {
			reject({
				success: false,
				error: "Alopu authentication currently doesn't support token validation"
			})
		}
	})
}

module.exports.auto = (args) => {
	/** this function will automatically find the token source if there is a token, 
	 * validate the authenticity of that token based off the provider,
	 * generate a native token
	 * either create a new entity if there is none associated with this provider
	 * or use the already linked entity
	 * and push this native auth token into the entities list of auth tokens
	 * then return a synced entity object for the client
   * @returns @type {Promise}
   * and do 1 or more of a few things, but always return the same thing
   * @param @var args @type {Object} is the arguments object with expected schema defined below
   * @param @var args.token @type {Object} is a provider token given by eg. google, facebook, twitter, github, etc.. 
   * can be undefined if you're authenticating a native user
   * @param @var args.clientId @type {Object} is the client id to be linked with the session token 
   * @param @var args.provider  @type {String} is the provider source, eg. google, facebook, twitter, github, etc..
   * @param @var args.entity @type {Object} is the entity object to be used with the authentication
   * if this isn't provided and no @var args.token is provided then the function will return an error
   * There are a few ways the api will handle a token and entity
   * @param @var args.upgrade @type {Boolean} is a true/false value denoting whether or not to upgrade and merge a provided entity data if
   * there is a native account already linked with whatever provider token is given
   *  NOT CURRENTLY SUPPORTED
   */
	return new Promise((resolve, reject)=>{
		if(args.provider || args.token || args.entity){
			var provider = s.getsmart(args, 'provider', s.getsmart(args, 'token.provider', false))
			/** check if provider handler exists */
			if(provider && args.token){
				var auther = s.getsmart(this, provider, undefined)
				if(auther){
					auther(args)
					.then((args)=>{
						if(args.success){
							s.setsmart(args, 'entity.registered.any', true)
							s.setsmart(args, 'entity.registered.'+provider, true)
							resolve(args)
						} else {
							console.error(`Something went wrong handling the ${args.provider} provider authentication verification`)
							reject({
								success: false,
								error: `Something went wrong handling the ${args.provider} provider authentication verification`								
							})
						}
					})
					.catch((err)=>{
						console.error(`There was an error handling the ${args.provider} provider authentication verification: `, err)
						reject({
							success: false,
							error: [`There was an error handling the ${args.provider} provider authentication verification`, err]
						})
					})
				} else {
					console.error(`there is no handler for ${args.provider}, 'please check your provided provider provider string and try again`)
					reject({
						success: false,
						error: `there is no handler for ${args.provider}, 'please check your provided provider provider string and try again`
					})
				}
			} else if(args.entity){
				this.alopu(args)
				.then(args=>{
					if(!args.provider == 'tmp'){
						s.setsmart(args, 'entity.registered.any', true)
					}
					s.setsmart(args, 'entity.registered.'+provider, true)
					resolve(args)
				})
				.catch(err=>{
					console.error('something went wrong authenticating a non-token login')
					reject(err)
				})
			} else {
				console.error("You didn't provide the right data for authentication to work, contex: ", args)
				reject({
					success: false,
					error: "You didn't provide the right data for authentication to work"
				})					
			}
		} else {
			console.error('something went wrong running the auto auth function, contex: ', args)
			reject({
				success: false,
				error: 'something went wrong running the auto auth function '
			})
		}
	})
}

module.exports.manifestSessionedEntity = (args) => {
	/** creates a session and relates it to an entity
	 * @param @var args @type {Object} is the main args object
	 * @param @var args.entity is the entity to create a session for
	 * if none is provided, a new entity will be created and returned with a valid session attached
	 * @returns @var args @type {Object} 
	 * @returns @var args.entity @type {Object} is an entity which will have a database ID and session token attached to it
	 */

	return new Promise((resolve, reject)=>{
		/** CREATE AND ADD SESSION TO ENTITY */
		this.manifestEntity(args)
		.then((args)=>{
			var sessions = s.gosmart(args, 'entity.sessions', [])
			var token = uuid()
			sessions.push({token, clientId: args.clientId})

			/** create custom firebase token */
				admin.auth().createCustomToken(s.gosmart(args, 'entity.uid', uuid()), s.getsmart(args, 'entity.firebase.additionalClaims', undefined))
				.then((customToken)=>{
					s.setsmart(args, 'entity.firebase.customToken', customToken)
					args.entityRef.update({sessions, firebase: args.entity.firebase})
					.then(()=>{
						args.success = true
						resolve(args)
					})
					.catch((err)=>{
						reject({
							success: false,
							error: [`Something went wrong updating the entities sessions: `, err]
						})
					})
				})
				.catch((error)=>{
					console.error("Error creating custom token: ", error);
				});

			
		})
		.catch(err=>{
			console.error('Something went wrong creating an entity in firestore: ', err)
			reject({
				success: false,
				error: ['Something went wrong creating an entity in firestore: ', err]
			})
		})
	})

}

module.exports.manifestEntity = (args) => {
	/** this function will attempt to find a database entity with any of the provided credentials if none exists it will create an entity via DocumentReference
	 * @returns @var args @type {Object} the same args object as passed
	 * @param @var args @type {Object} is an arguments object containing all arguments used in this function
	 * @param @var args.entity @type {Object} is an entity object containing the credentials we're going to use to track down  entity
	 * @param @var args.token @type {Object} is a provider token which we will use as a fallback to track down an entity
	 * @param @var args.provider is the name of the preferred provider credentials to be used to find an entity
	 */
	
		return new Promise((resolve, reject)=>{
			var provider = this.provider(args)
			var providerId = this.providerId(args)
			var providerIdString = this.providerIdString(args)
			var things = db.collection(`${s.getsmart(global, 'env.level', 'dev')}/things/users`)
			if(providerId){
				things = things.where(provider+'.'+providerIdString, '==', providerId)
				things.get()
				.then(res=>{
					if(res.size){
						args.entityRef = res.docs[0].ref
						Object.assign(args.entity, res.docs[0].data())
						resolve(args)
					} else {
						this.createNewEntity(args)
						.then(args=>{
							resolve(args)
						})
						.catch(err=>{
							console.error('Something went wrong creating a new entity in firestore: ', err)
							reject({
								success: false,
								error: ['Something went wrong creating a new entity in firestore: ', err]
							})
						})
					}
				})
				.catch(err=>{
					console.error('Something went wrong getting the entity from firestore: ', err)
					reject({
						success: false,
						error: ['Something went wrong getting the entity from firestore: ', err]
					})
				})
			}	
			/** need to create an entity */
			else {
				this.createNewEntity(args)
				.then(args=>{
					resolve(args)
				})
				.catch(err=>{
					console.error('Something went wrong creating a new entity in firestore: ', err)
					reject({
						success: false,
						error: ['Something went wrong creating a new entity in firestore: ', err]
					})
				})
			}	
		})
}

module.exports.createNewEntity = (args) => {

	/** this function will create a new entity with a few known constant properties attached and link any provider data found in a token
	 * @returns @var args @type {Object}
	 * @param @var args @type {Object}
	 */
	args.newEntity = true
	return new Promise((resolve, reject)=>{
		/** generate firestore id */
			var things = db.collection(`${s.getsmart(global, 'env.level', 'dev')}/things/users`)
			args.entityRef = things.doc()
		/** merge any anonymous entity data with required values */
			args.entity = {sessions: [], ...args.entity}
		/** set firestore id fields */
			s.setsmart(args.entity, 'ids.id-firestore', s.gosmart(args.entity, 'firestore.id', args.entityRef.id))
		/** merge provider token data */
			var provider = this.provider(args)
			var providerId = this.providerId(args)
			var providerIdString = this.providerIdString(args)
			if(provider !== 'firestore'){
				s.setsmart(args, 'entity.'+provider+'.'+providerIdString, providerId)
				s.setsmart(args, 'entity.ids.'+providerIdString+'-'+provider, providerId)
				s.setsmart(args, 'entity.ids.'+providerIdString+'-'+provider, providerId)
			}
			var token = s.getsmart(args, 'token', false)
			if(token){
				var tokens = s.gosmart(args, provider+'.tokens', [])
				tokens.push(token)
			}
		var providerPassword = s.getsmart(args, 'entity.'+provider+'.password', false)
		if(providerPassword){
			s.setsmart(args, 'entity.'+provider+'.password', bcrypt.hashSync(providerPassword, bcrypt.genSaltSync(9)))
		}
		if(!args.entity.uid){
			args.entity.uid = uuid()
		}

		/** set new data */
			args.entityRef.set(args.entity, {merge: true})
			.then(()=>{
				resolve(args)
			})
			.catch(err=>{
				console.error('Something went wrong creating an entity in firestore while creating a new entity: ', err)
				reject({
					success: false,
					error: ['Something went wrong creating an entity in firestore while creating a new entity: ', err]
				})
			})
	})
}

module.exports.providerId = (args) => {
	var idLinkString = this.providerIdPath(args)
	return s.getsmart(args, idLinkString, undefined)
}

module.exports.providerIdPath = (args) => {
	/** this function will generate the property string of where the link value should be database side */
		var provider = this.provider(args)
		var providerIdString = this.providerIdString(args)
		var look = args.token ? 'token' : 'entity.'+provider
		if(provider == 'facebook'){
			return look+'.authResponse.'+providerIdString
		} else if(provider == 'google'){
			return look+'.'+providerIdString
		} else if(provider == 'alopu'){
			return look+'.'+providerIdString
		} else if(provider == 'tmp'){
			return 'entity.uid'
		} else if(provider == 'native'){
			return look+'.'+providerIdString
		} else if(provider == 'mobile'){
			return look+'.'+providerIdString
		} else if(provider == 'email'){
			return look+'.'+providerIdString
		} else if(provider == 'github'){
			return look+'.'+providerIdString
		} else if(provider == 'twitter'){
			return look+'.'+providerIdString
		} else {
			return look+'.'+providerIdString
		}
}

module.exports.providerIdString = (args) => {
		/** this function will generate the property string of where the link value should be database side */
		var provider = this.provider(args)
		if(provider == 'facebook'){
			return 'userID'
		} else if(provider == 'google'){
			return 'El'
		} else if(provider == 'alopu'){
			return 'username'
		} else if(provider == 'native'){
			return 'id'
		} else if(provider == 'mobile'){
			return 'id'
		} else if(provider == 'email'){
			return 'id'
		} else if(provider == 'github'){
			return 'id'
		} else if(provider == 'twitter'){
			return 'id'
		} else if(provider == 'tmp'){
			return 'uid'
		} else {
			return 'username'
		}

}

module.exports.providerDataPath = (args) => {
	/** will return the path to the provider provided entity data */

}

module.exports.provider = (args) => {
	/** will normalise a provider string */
		var provider = s.getsmart(args, 'provider', s.getsmart(args, 'token.provider', undefined))
		if(provider == 'facebook' || provider == 'fb'){
			return 'facebook'
		} else if(provider == 'google' || provider == 'g'){
			return 'google'
		} else if(provider == 'alopu' || provider == 'a'){
			return 'alopu'
		} else if(provider == 'native' || provider == 'n'){
			return 'native'
		} else if(provider == 'mobile' || provider == 'm'){
			return 'mobile'
		} else if(provider == 'email' || provider == 'e'){
			return 'email'
		} else if(provider == 'github' || provider == 'gh'){
			return 'github'
		} else if(provider == 'twitter' || provider == 't'){
			return 'twitter'
		} else if(provider == 'tmp'){
			return 'tmp'
		} else {
			return 'alopu'
		}
}

module.exports.providers = [ 'email', 'facebook', 'google', 'alopu' ] /** twitter, mobile, and github to come */