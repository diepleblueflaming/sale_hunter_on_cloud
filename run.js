"use strict";
/**
 * Project: sendo_sale_hunter
 * Author: Le Hai Diep(dieple)
 * Date-Time: 18/06/2019-21:51
 */
const https = require("https");
const nodeSchedule = require('node-schedule');
const winston = require('winston');

const Cookie = `_ga=GA1.3.2042790980.1560079024; _gid=GA1.3.1461826516.1561476627; __stgeo="0"; tracking_id=ecdc97eec4274f72884b175d3e4856b8; browserid=72c2a336c25130f4a1948ddd44b13e87; _gcl_au=1.1.687588649.1561982955; _ga=GA1.2.711477298.1561982955; _gid=GA1.2.383296702.1561982955; cto_lwid=e29f8b1f-7ba9-4866-988b-fb810e881195; _fbp=fb.1.1561982955690.1122777074; s_c_id_type=fosp; login_type=fosp; _gac_UA-32891946-1=1.1562241269.CjwKCAjwx_boBRA9EiwA4kIELgoBU-bepMQ6dS5qmu785kCLlBZVVs_1aYAHPVeYXNSOjiH3EiyU3BoC-lIQAvD_BwE; _gcl_aw=GCL.1562241269.CjwKCAjwx_boBRA9EiwA4kIELgoBU-bepMQ6dS5qmu785kCLlBZVVs_1aYAHPVeYXNSOjiH3EiyU3BoC-lIQAvD_BwE; _gac_UA-32891946-6=1.1562241271.CjwKCAjwx_boBRA9EiwA4kIELgoBU-bepMQ6dS5qmu785kCLlBZVVs_1aYAHPVeYXNSOjiH3EiyU3BoC-lIQAvD_BwE; _gac_UA-32891946-6=1.1562241271.CjwKCAjwx_boBRA9EiwA4kIELgoBU-bepMQ6dS5qmu785kCLlBZVVs_1aYAHPVeYXNSOjiH3EiyU3BoC-lIQAvD_BwE; __stp={"visit":"returning","uuid":"aafe20b7-8edf-41f1-bfb2-9c53261f3ff7","ck":"2028616397"}; __stdf=0; _fbc=fb.1.1562422522001.IwAR2taParIO8B3y4WUq9MdpMbVqbZOK8LgziOE293JmgqLBTmDPPhaWVPWF8; access_token=VUN3QGqhO4iEiBMP5r4ReSyxfFu%2B%2FW7jNwyN%2BqQ4I76G7TxfP33bFbythUB5q%2B0Eb6IIUuxuaZNSGOKvEow%2Fx1K%2FV%2Bkn8joS9UfCLgC7NP7ypMRxR2MDuBozumZXC6aYiyDrwe6wzig4Bf6S0HzmfgNnWFdMrGwsNdK4%2FS4uUoA%3D; s_c_id_status=return; __utmz=147100981.1562500358.34.6.utmcsr=google|utmccn=(organic)|utmcmd=organic|utmctr=(not%20provided); SSID=0imo3kgj8m7auhmpqk4d6kg7b1; __utmc=147100981; __utma=147100981.711477298.1561982955.1562588879.1562593584.40; __utmt=1; _dc_gtm_UA-32891946-6=1; _gat_UA-32891946-6=1; __stbpnenable=1; __utmb=147100981.23.7.1562593625364; WZRK_G=1206267572da46b08942116ec71a1f7f; __sts={"sid":1562593616463,"tx":1562593626783,"url":"https%3A%2F%2Fcheckout.sendo.vn%2F%3Fproduct%3D326db4816e0bfd891748e3762da557c3%26sendo_platform%3Ddesktop2%26shop%3D400350","pet":1562593626783,"set":1562593616463,"pUrl":"https%3A%2F%2Fcheckout.sendo.vn%2F%3Fproduct%3Dcf899594c1775b9a6832a03197784de0%26sendo_platform%3Ddesktop2%26shop%3D462964","pPet":1562593616463,"pTx":1562593616463}; WZRK_S_466-944-R55Z=%7B%22p%22%3A9%2C%22s%22%3A1562593585%2C%22t%22%3A1562593626%7D`;


/*** config winston **/
const logger = winston.createLogger({
	transports: [
		// new winston.transports.File({ filename: 'saleLog.txt'})
		new winston.transports.Console()
	]
});
/*** config winston **/

const headers = {
	'Cookie': Cookie,
	'Content-Type': 'application/json'
};


function saleHunter(current_product_hash, currentShopId, plan) {
	console.log('start', new Date().getMinutes(),  new Date().getHours());
	const TOTAL_REQUEST = 20;
	let current_number_request = 0;
	let is_bought_success = false;
	let mainInterval = null;
	let saveOrderData = null;

	const relativePlan = new Date(plan - 5000);
	const job = nodeSchedule.scheduleJob(relativePlan, function () {
		const relativeTime = 0.1 * 1000;
		const myInterval = setInterval(function () {
			const now = new Date().getTime();
			if ((plan - now) < relativeTime) {
				clearInterval(myInterval);
				console.log('start', new Date().getHours());
				logger.info(`*******************************************`);
				logger.info(`Start hunter: ` + new Date().toUTCString());
				mainInterval = setInterval(function () {
					if (current_number_request < TOTAL_REQUEST && !is_bought_success) {
						if (saveOrderData) {
							buy();
						} else {
							getInfo();
						}
						current_number_request++;
					} else {
						clearInterval(mainInterval);
					}
				}, 55);
			}
		}, 50);
	});

	function getInfo() {
		const url = 'https://checkout.sendo.vn/api/checkout/info';
		const body = JSON.stringify({
			"shop_id": Number(currentShopId),
			"item_hash": String(current_product_hash),
			"sendo_platform": "desktop2",
			"current_voucher": {"enable_suggest_voucher": true},
			"enable_tracking": true,
			"ignore_invalid_product": -1,
			"version": 2.1
		});

		post(url, body, headers).
		then((res) => {
			console.log('info response', res.data.products_checkout);
			if (typeof res.data !== 'undefined' && typeof res.data.products_checkout.products[0].promotion !== 'undefined') {
				buy(res.data);
			}
		}).catch((error) => {
			logger.error(`${url} failed with reason: ${error.message}`);
		});
	}


	function buy(res) {
		let body = null;
		if (!saveOrderData) {
			body = {
				"shop_id": Number(currentShopId),
				"item_hash": current_product_hash,
				"current_products": null,
				"current_address_id": null,
				"current_carrier": null,
				"current_payment_method": {
					"method": "cod_payment"
				},
				"current_voucher": {
					"voucher_code": "",
					"voucher_value": 0,
					"is_shop_voucher": false,
					"voucher_campaign_code": "",
					"sub_total": 0,
					"payment_method": "",
					"error": "",
					"is_enable_captcha": false,
					"captcha_response": "",
					"enable_suggest_voucher": true,
					"tracking_order_source": 0,
					"suggested_message": "",
					"redeemed_at": 0
				},
				"sendo_platform": "desktop2",
				"ignore_invalid_product": -1,
				"product_hashes": [current_product_hash],
				"version": 2.1
			};

			body.current_products = res.products_checkout.products;
			body.current_address_id = res.customer_data.current_address_id;
			body.current_carrier = res.shipping_info.current_carrier;
			body = JSON.stringify(body);
			saveOrderData = body;
		} else {
			body = saveOrderData;
		}

		const url = 'https://checkout.sendo.vn/api/checkout/save-order';
		post(url, body, headers).
		then((data) => {
			if (data.increment_id !== undefined && data.payment_type !== undefined) {
				is_bought_success = true;
				clearInterval(mainInterval);
				const now = new Date();
				return logger.info(`Hunter Success: ${now.getMinutes()} ${now.getMilliseconds()}`);
			}
			logger.info(`Hunter Failure: ` + new Date().toUTCString());
		}).catch((error) => {
			logger.error(`${url} failed with reason: ${error.message}`);
		});
	}


	function post(url, body, headers) {
		return new Promise((resolve, reject) => {
			const options = {
				method: 'POST',
				headers,
				rejectUnauthorized: false
			};
			const req = https.request(url, options, (response) => {
				let data = [];
				response.on('data', (chunk) => {
					data.push(chunk);
				});
				response.on('end', () => {
					logger.info(`${url}: ${response.statusCode}`);
					if (response.statusCode === 200) {
						data = Buffer.concat(data);
						data = JSON.parse(data.toString());
						return resolve(data);
					}
					return reject(null);
				});
			});
			req.on('error', (error) => {
				return reject(error);
			});
			req.write(body);
			req.end();
		});
	}
}

saleHunter('326db4816e0bfd891748e3762da557c3',400350 , new Date(2019, 6, 8, 11).getTime());