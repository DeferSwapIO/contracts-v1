const BigNumber = require('bignumber.js');

const DeferSwap = artifacts.require("DeferSwap");
const Mine = artifacts.require("Mine");
const AmountComp = artifacts.require("AmountComp");
const UsdtToken = artifacts.require('Usdt');
const DaiToken = artifacts.require('Dai');

const TOKEN_ETH = 'ETH';
const TOKEN_USDT = 'USDT';
const TOKEN_DAI = 'DAI';

const ADDRESS0 = '0x0000000000000000000000000000000000000000';

const PRICE_DECIMAL = 100000000;

const ORDER_STATUS = {
    default: 0,
    cancel: 5,
    part: 7,
    deal: 9
};

contract('DeferSwap', async accounts => {

    it('createOrder => a0,a1 > 0', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });

        try {
            await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 0, 0, true, [], { from: accounts[2] });
        } catch (e) {
            assert.equal('DeferSwap: params error.1', e.reason);
        }
    });

    it('createOrder => pair must register', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });

        try {
            await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3200, true, [], { from: accounts[2] });
        } catch (e) {
            assert.equal('DeferSwap: token unsupport', e.reason);
        }
    })

    it('createOrder => p0 != p1', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });

        try {
            await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_ETH, 1, 3200, true, [], { from: accounts[2] });
        } catch (e) {
            assert.equal('DeferSwap: params error.2', e.reason);
        }
    })

    it('createOrder => amount insufficient', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        try {
            await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3200, true, [], { from: accounts[2] });
        } catch (e) {
            assert.equal('DeferSwap: params error.4', e.reason);
        }
    })

    it('createOrder => amount token insufficient', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        try {
            await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3200, false, [], { from: accounts[2] });
        } catch (e) {
            assert.equal('ERC20: transfer amount exceeds balance', e.reason);
        }
    })

    it('createOrder => amount token unapprove', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await usdtInstance.transfer(accounts[2], 10e5, { from: accounts[1] });

        try {
            await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3200, false, [], { from: accounts[2] });
        } catch (e) {
            assert.equal('ERC20: transfer amount exceeds allowance', e.reason);
        }
    })

    it('createOrder => create order success => sell', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        let result = await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3200, true, [], { from: accounts[2], value: 1 });

        let log = result.logs[0];
        assert.equal('OrderCreatedEvt', log.event);
        assert.equal(1, log.args.order_no);
        assert.equal(TOKEN_ETH, log.args.pair0);
        assert.equal(TOKEN_USDT, log.args.pair1);
        assert.equal(1, log.args.amount0);
        assert.equal(3200, log.args.amount1);
        assert.equal(1, log.args.amount0_rem);
        assert.equal(3200, log.args.amount1_rem);
        assert.equal(true, log.args.is_sell);
        assert.equal(ORDER_STATUS.default, log.args.status);
        assert.equal(new BigNumber(3200).multipliedBy(PRICE_DECIMAL).toString(10), log.args.price.toString(10));

        // 合约的ETH余额
        assert.equal(1, await web3.eth.getBalance(deferSwapInstance.address));
    })

    it('createOrder => create order success => buy', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await usdtInstance.transfer(accounts[2], 10e5, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 3200, { from: accounts[2] });

        let result = await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3200, false, [], { from: accounts[2] });

        let log = result.logs[0];
        assert.equal('OrderCreatedEvt', log.event);
        assert.equal(1, log.args.order_no);
        assert.equal(TOKEN_ETH, log.args.pair0);
        assert.equal(TOKEN_USDT, log.args.pair1);
        assert.equal(1, log.args.amount0);
        assert.equal(3200, log.args.amount1);
        assert.equal(1, log.args.amount0_rem);
        assert.equal(3200, log.args.amount1_rem);
        assert.equal(false, log.args.is_sell);
        assert.equal(ORDER_STATUS.default, log.args.status);
        assert.equal(new BigNumber(3200).multipliedBy(PRICE_DECIMAL).toString(10), log.args.price.toString(10));

        let deferSwapBalance = await usdtInstance.balanceOf(deferSwapInstance.address);
        assert.equal(3200, deferSwapBalance);
    });

    it('createOrder => create order success => sell => repeat', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        let result = await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3200, true, [], { from: accounts[2], value: 1 });

        let log = result.logs[0];
        assert.equal('OrderCreatedEvt', log.event);
        assert.equal(1, log.args.order_no);
        assert.equal(TOKEN_ETH, log.args.pair0);
        assert.equal(TOKEN_USDT, log.args.pair1);
        assert.equal(1, log.args.amount0);
        assert.equal(3200, log.args.amount1);
        assert.equal(1, log.args.amount0_rem);
        assert.equal(3200, log.args.amount1_rem);
        assert.equal(true, log.args.is_sell);
        assert.equal(ORDER_STATUS.default, log.args.status);
        assert.equal(new BigNumber(3200).multipliedBy(PRICE_DECIMAL).toString(10), log.args.price.toString(10));

        // 合约的ETH余额
        assert.equal(1, await web3.eth.getBalance(deferSwapInstance.address));

        result = await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 2, 6400, true, [], { from: accounts[2], value: 2 });

        log = result.logs[0];
        assert.equal('OrderCreatedEvt', log.event);
        assert.equal(2, log.args.order_no);
        assert.equal(TOKEN_ETH, log.args.pair0);
        assert.equal(TOKEN_USDT, log.args.pair1);
        assert.equal(2, log.args.amount0);
        assert.equal(6400, log.args.amount1);
        assert.equal(2, log.args.amount0_rem);
        assert.equal(6400, log.args.amount1_rem);
        assert.equal(true, log.args.is_sell);
        assert.equal(ORDER_STATUS.default, log.args.status);
        assert.equal(new BigNumber(3200).multipliedBy(PRICE_DECIMAL).toString(10), log.args.price.toString(10));

        // 合约的ETH余额
        assert.equal(3, await web3.eth.getBalance(deferSwapInstance.address));
    });

    it('createOrder => create order success => sell => eat => fail => order not exists', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        // 创建卖单，指定了吃单，则会自动吃单
        try {
            await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 10, 32000, true, [1, 2], { from: accounts[2], value: 10 });
        } catch (e) {
            assert.equal("DeferSwap: params error.3", e.reason);
        }
    })

    it('createOrder => create order success => sell => eat => fail => order status has cancel', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await usdtInstance.transfer(accounts[3], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e10, { from: accounts[3] });

        await usdtInstance.transfer(accounts[4], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e10, { from: accounts[4] });

        // 创建买单 - 价格3200
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 3, 9600, false, [], { from: accounts[3] });
        // 创建买单 - 价格3300
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 3, 9900, false, [], { from: accounts[4] });

        await deferSwapInstance.cancelOrder(1, { from: accounts[3] });

        try {
            await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 10, 32000, true, [1, 2], { from: accounts[2], value: 10 });
        } catch (e) {
            assert.equal("DeferSwap: params error.3", e.reason);
        }
    })

    it('createOrder => create order success => sell => eat => fail => order has sell', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await usdtInstance.transfer(accounts[3], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e10, { from: accounts[3] });

        await usdtInstance.transfer(accounts[4], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e10, { from: accounts[4] });

        // 创建买单 - 价格3200
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 3, 9600, true, [], { from: accounts[3], value: 3 });
        // 创建买单 - 价格3300
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 3, 9900, false, [], { from: accounts[4] });

        try {
            await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 10, 32000, true, [1, 2], { from: accounts[2], value: 10 });
        } catch (e) {
            assert.equal("DeferSwap: params error.3", e.reason);
        }
    })

    it('createOrder => create order success => sell => eat => fail => pair not equal', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });
        let daiInstance = await DaiToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_DAI, 18, daiInstance.address, { from: accounts[1] });

        await daiInstance.transfer(accounts[3], 1e6, { from: accounts[1] });
        await daiInstance.approve(deferSwapInstance.address, 1e10, { from: accounts[3] });

        await usdtInstance.transfer(accounts[4], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e10, { from: accounts[4] });

        // 创建买单 - 价格3200
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_DAI, 3, 9600, false, [], { from: accounts[3] });
        // 创建买单 - 价格3300
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 3, 9900, false, [], { from: accounts[4] });

        try {
            await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 10, 32000, true, [1, 2], { from: accounts[2], value: 10 });
        } catch (e) {
            assert.equal("DeferSwap: params error.3", e.reason);
        }
    })

    it('createOrder => create order success => sell => eat => fail => buy price lt sell price', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await usdtInstance.transfer(accounts[3], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e10, { from: accounts[3] });

        await usdtInstance.transfer(accounts[4], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e10, { from: accounts[4] });

        // 价格500
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 3, 1500, false, [], { from: accounts[3] });
        // 价格3200
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 3, 9600, false, [], { from: accounts[4] });

        try {
            await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 10, 32000, true, [1, 2], { from: accounts[2], value: 10 });
        } catch (e) {
            assert.equal("DeferSwap: params error.5", e.reason);
        }
    })

    it('createOrder => create order success => buy => eat => fail => sell price gt buy price', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await usdtInstance.transfer(accounts[2], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e10, { from: accounts[2] });

        // 价格4000
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 3, 12000, true, [], { from: accounts[3], value: 3 });
        // 价格3200
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 3, 9600, true, [], { from: accounts[4], value: 3 });

        try {
            await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 10, 32000, false, [1, 2], { from: accounts[2] });
        } catch (e) {
            assert.equal("DeferSwap: params error.5", e.reason);
        }
    })

    it('createOrder => create order success => sell => dealPart', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        // 交易统计
        let mineInstance = await Mine.new({ from: accounts[1] });
        let amountCompInstance = await AmountComp.new({ from: accounts[1] });
        await amountCompInstance.setStableToken(TOKEN_USDT, true, { from: accounts[1] });
        await mineInstance.setAmountCompContract(amountCompInstance.address, { from: accounts[1] });
        await mineInstance.setWriteAddress(deferSwapInstance.address, { from: accounts[1] });
        await deferSwapInstance.setNotifyContract(mineInstance.address, { from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await usdtInstance.transfer(accounts[3], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e10, { from: accounts[3] });

        await usdtInstance.transfer(accounts[4], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e10, { from: accounts[4] });

        // 创建买单 - 价格3200
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 3, 9600, false, [], { from: accounts[3] });

        // 创建买单 - 价格3300
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 3, 9900, false, [], { from: accounts[4] });

        let a3BefBalance = await web3.eth.getBalance(accounts[3]);
        let a4BefBalance = await web3.eth.getBalance(accounts[4]);

        // 创建卖单，指定了吃单，则会自动吃单
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 10, 32000, true, [1, 2], { from: accounts[2], value: 10 });

        let order1 = await deferSwapInstance.orders(1);
        assert.equal(ORDER_STATUS.deal, order1.status);
        assert.equal(0, order1.amount0_rem);
        assert.equal(0, order1.amount1_rem);

        assert.equal(new BigNumber(a3BefBalance).plus(3).toString(10), await web3.eth.getBalance(accounts[3]));
        // 花费了9600个usdt
        assert.equal(await usdtInstance.balanceOf(accounts[3]), new BigNumber(1e6).minus(9600).toString(10));

        let order2 = await deferSwapInstance.orders(2);
        assert.equal(ORDER_STATUS.deal, order2.status);
        assert.equal(0, order2.amount0_rem);
        assert.equal(0, order2.amount1_rem);

        assert.equal(new BigNumber(a4BefBalance).plus(3).toString(10), await web3.eth.getBalance(accounts[4]));
        // 挂单9900，但是实际花费9600，因为是3200的价格成交的
        assert.equal(await usdtInstance.balanceOf(accounts[4]), new BigNumber(1e6).minus(9600).toString(10));

        let order3 = await deferSwapInstance.orders(3);
        assert.equal(ORDER_STATUS.part, order3.status);
        assert.equal(4, order3.amount0_rem.toString(10));
        assert.equal(12800, order3.amount1_rem.toString(10));

        // 得到了3200*6个usdt
        assert.equal(await usdtInstance.balanceOf(accounts[2]), 3200 * 6);
    })

    it('createOrder => create order success => sell => dealFull', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        // 交易统计
        let mineInstance = await Mine.new({ from: accounts[1] });
        let amountCompInstance = await AmountComp.new({ from: accounts[1] });
        await amountCompInstance.setStableToken(TOKEN_USDT, true, { from: accounts[1] });
        await mineInstance.setAmountCompContract(amountCompInstance.address, { from: accounts[1] });
        await mineInstance.setWriteAddress(deferSwapInstance.address, { from: accounts[1] });
        await deferSwapInstance.setNotifyContract(mineInstance.address, { from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await usdtInstance.transfer(accounts[3], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e10, { from: accounts[3] });

        await usdtInstance.transfer(accounts[4], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e10, { from: accounts[4] });

        await usdtInstance.transfer(accounts[5], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e10, { from: accounts[5] });

        // 创建买单 - 价格3200
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 3, 9600, false, [], { from: accounts[3] });

        // 创建买单 - 价格3300
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 3, 9900, false, [], { from: accounts[4] });

        // 创建买单 - 价格3200
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 10, 32000, false, [], { from: accounts[5] });

        let a3BefBalance = await web3.eth.getBalance(accounts[3]);
        let a4BefBalance = await web3.eth.getBalance(accounts[4]);
        let a5BefBalance = await web3.eth.getBalance(accounts[5]);

        // 创建卖单，指定了吃单，则会自动吃单
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 10, 32000, true, [1, 2, 3], { from: accounts[2], value: 10 });

        let order1 = await deferSwapInstance.orders(1);
        assert.equal(ORDER_STATUS.deal, order1.status);
        assert.equal(0, order1.amount0_rem);
        assert.equal(0, order1.amount1_rem);

        // 得到 3wei
        assert.equal(new BigNumber(a3BefBalance).plus(3).toString(10), await web3.eth.getBalance(accounts[3]));
        // 花费了9600个usdt
        assert.equal(await usdtInstance.balanceOf(accounts[3]), new BigNumber(1e6).minus(9600).toString(10));

        let order2 = await deferSwapInstance.orders(2);
        assert.equal(ORDER_STATUS.deal, order2.status);
        assert.equal(0, order2.amount0_rem);
        assert.equal(0, order2.amount1_rem);

        // 得到 3wei
        assert.equal(new BigNumber(a4BefBalance).plus(3).toString(10), await web3.eth.getBalance(accounts[4]));
        // 挂单9900，但是实际花费9600，因为是3200的价格成交的
        assert.equal(await usdtInstance.balanceOf(accounts[4]), new BigNumber(1e6).minus(9600).toString(10));

        let order3 = await deferSwapInstance.orders(3);
        assert.equal(ORDER_STATUS.part, order3.status);
        assert.equal(6, order3.amount0_rem.toString(10));
        assert.equal(19200, order3.amount1_rem.toString(10));

        // 得到 4wei
        assert.equal(new BigNumber(a5BefBalance).plus(4).toString(10), await web3.eth.getBalance(accounts[5]));
        // 花费12800
        assert.equal(new BigNumber(await usdtInstance.balanceOf(accounts[5])).toString(10), new BigNumber(1e6).minus(32000).toString(10));

        let order4 = await deferSwapInstance.orders(4);
        assert.equal(ORDER_STATUS.deal, order4.status);
        assert.equal(0, order4.amount0_rem);
        assert.equal(0, order4.amount1_rem);

        // 得到32000usdt
        assert.equal(32000, new BigNumber(await usdtInstance.balanceOf(accounts[2])).toString(10));
    })

    it('createOrder => create order success => buy => dealFull', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        // 交易统计
        let mineInstance = await Mine.new({ from: accounts[1] });
        let amountCompInstance = await AmountComp.new({ from: accounts[1] });
        await amountCompInstance.setStableToken(TOKEN_USDT, true, { from: accounts[1] });
        await mineInstance.setAmountCompContract(amountCompInstance.address, { from: accounts[1] });
        await mineInstance.setWriteAddress(deferSwapInstance.address, { from: accounts[1] });
        await deferSwapInstance.setNotifyContract(mineInstance.address, { from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await usdtInstance.transfer(accounts[2], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e10, { from: accounts[2] });

        // 创建卖单 - 价格3200
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 3, 9600, true, [], { from: accounts[3], value: 3 });

        // 创建卖单 - 价格3300
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 3, 9000, true, [], { from: accounts[4], value: 3 });

        // 创建卖单 - 价格3500
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 10, 31000, true, [], { from: accounts[5], value: 10 });

        // 创建买单，指定了吃单，则会自动吃单
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 10, 32000, false, [1, 2, 3], { from: accounts[2] });

        let order1 = await deferSwapInstance.orders(1);
        assert.equal(ORDER_STATUS.deal, order1.status);
        assert.equal(0, order1.amount0_rem);
        assert.equal(0, order1.amount1_rem);
        // 获得9600usdt
        assert(9600, new BigNumber(await usdtInstance.balanceOf(accounts[3])).toString(10));

        let order2 = await deferSwapInstance.orders(2);
        assert.equal(ORDER_STATUS.deal, order2.status);
        assert.equal(0, order2.amount0_rem);
        assert.equal(0, order2.amount1_rem);
        // 获得9600usdt
        assert(9000, new BigNumber(await usdtInstance.balanceOf(accounts[4])).toString(10));

        let order3 = await deferSwapInstance.orders(3);
        assert.equal(ORDER_STATUS.part, order3.status);
        assert.equal(6, order3.amount0_rem);
        assert.equal(18600, order3.amount1_rem);
        // 获得9600usdt
        assert(12400, new BigNumber(await usdtInstance.balanceOf(accounts[4])).toString(10));

        let order4 = await deferSwapInstance.orders(4);
        assert.equal(ORDER_STATUS.deal, order4.status);
        assert.equal(0, order4.amount0_rem);
        assert.equal(0, order4.amount1_rem);

        // 挂单3200的价格，但是实际成交是3200*3+3000*3+3100*4 = 31000 ，收到退款 1000usdt
        assert(new BigNumber(1e6).minus(31000).toString(10), new BigNumber(await usdtInstance.balanceOf(accounts[2])).toString(10));
    })

    it('createOrder => create order success => buy => dealFull', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        // 交易统计
        let mineInstance = await Mine.new({ from: accounts[1] });
        let amountCompInstance = await AmountComp.new({ from: accounts[1] });
        await amountCompInstance.setStableToken(TOKEN_USDT, true, { from: accounts[1] });
        await mineInstance.setAmountCompContract(amountCompInstance.address, { from: accounts[1] });
        await mineInstance.setWriteAddress(deferSwapInstance.address, { from: accounts[1] });
        await deferSwapInstance.setNotifyContract(mineInstance.address, { from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await usdtInstance.transfer(accounts[2], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e10, { from: accounts[2] });

        // 创建卖单 - 价格3200
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 3, 9600, true, [], { from: accounts[3], value: 3 });

        // 创建卖单 - 价格3300
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 3, 9000, true, [], { from: accounts[4], value: 3 });

        // 创建买单，指定了吃单，则会自动吃单
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 10, 32000, false, [1, 2], { from: accounts[2] });

        let order1 = await deferSwapInstance.orders(1);
        assert.equal(ORDER_STATUS.deal, order1.status);
        assert.equal(0, order1.amount0_rem);
        assert.equal(0, order1.amount1_rem);
        // 获得9600usdt
        assert(9600, new BigNumber(await usdtInstance.balanceOf(accounts[3])).toString(10));

        let order2 = await deferSwapInstance.orders(2);
        assert.equal(ORDER_STATUS.deal, order2.status);
        assert.equal(0, order2.amount0_rem);
        assert.equal(0, order2.amount1_rem);
        // 获得9600usdt
        assert(9000, new BigNumber(await usdtInstance.balanceOf(accounts[4])).toString(10));

        let order3 = await deferSwapInstance.orders(3);
        assert.equal(ORDER_STATUS.part, order3.status);
        assert.equal(4, order3.amount0_rem);
        assert.equal(12800, order3.amount1_rem);
    })

    // ------------ cancelOrder ------

    it('cancelOrder => fail => order not exists', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3200, true, [], { from: accounts[2], value: 1 });

        try {
            await deferSwapInstance.cancelOrder(1000, { from: accounts[2] });
        } catch (e) {
            assert.equal('DeferSwap: order not exists', e.reason);
        }
    })

    it('cancelOrder => fail => unauthorized', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3200, true, [], { from: accounts[2], value: 1 });

        try {
            await deferSwapInstance.cancelOrder(1, { from: accounts[3] });
        } catch (e) {
            assert.equal('DeferSwap: unauthorized', e.reason);
        }
    })

    it('cancelOrder => sell', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3200, true, [], { from: accounts[2], value: 1 });

        let result = await deferSwapInstance.cancelOrder(1, { from: accounts[2] });

        let log = result.logs[0];
        assert.equal('OrderCancelEvt', log.event);
        assert.equal(ORDER_STATUS.cancel, log.args.status);
        assert.equal(1, log.args.amount0_rem);
        assert.equal(3200, log.args.amount1_rem);
    })

    it('cancelOrder => buy', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await usdtInstance.transfer(accounts[2], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 3200, { from: accounts[2] });

        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3200, false, [], { from: accounts[2] });

        let result = await deferSwapInstance.cancelOrder(1, { from: accounts[2] });

        let log = result.logs[0];
        assert.equal('OrderCancelEvt', log.event);
        assert.equal(ORDER_STATUS.cancel, log.args.status);
        assert.equal(1, log.args.amount0_rem);
        assert.equal(3200, log.args.amount1_rem);

        assert(1e6, new BigNumber(await usdtInstance.balanceOf(accounts[2])).toString(10));
    });

    it('cancelOrder => fail => order has cancel', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3200, true, [], { from: accounts[2], value: 1 });

        await deferSwapInstance.cancelOrder(1, { from: accounts[2] });

        try {
            await deferSwapInstance.cancelOrder(1, { from: accounts[2] });
        } catch (e) {
            assert.equal('DeferSwap: order has cancel/complete', e.reason);
        }
    })

    it('cancelOrder => fail => order has complete', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        // 交易统计
        let mineInstance = await Mine.new({ from: accounts[1] });
        let amountCompInstance = await AmountComp.new({ from: accounts[1] });
        await amountCompInstance.setStableToken(TOKEN_USDT, true, { from: accounts[1] });
        await mineInstance.setAmountCompContract(amountCompInstance.address, { from: accounts[1] });
        await mineInstance.setWriteAddress(deferSwapInstance.address, { from: accounts[1] });
        await deferSwapInstance.setNotifyContract(mineInstance.address, { from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3200, true, [], { from: accounts[2], value: 1 });

        await usdtInstance.transfer(accounts[3], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[3] });

        await deferSwapInstance.dealOrder(1, 3200, { from: accounts[3] });

        try {
            await deferSwapInstance.cancelOrder(1, { from: accounts[2] });
        } catch (e) {
            assert.equal('DeferSwap: order has cancel/complete', e.reason);
        }
    })

    it('cancelOrder => success => buy => dealPart', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        // 交易统计
        let mineInstance = await Mine.new({ from: accounts[1] });
        let amountCompInstance = await AmountComp.new({ from: accounts[1] });
        await amountCompInstance.setStableToken(TOKEN_USDT, true, { from: accounts[1] });
        await mineInstance.setAmountCompContract(amountCompInstance.address, { from: accounts[1] });
        await mineInstance.setWriteAddress(deferSwapInstance.address, { from: accounts[1] });
        await deferSwapInstance.setNotifyContract(mineInstance.address, { from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await usdtInstance.transfer(accounts[2], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[2] });

        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 3, 9600, false, [], { from: accounts[2] });

        // 成交了1wei => 3200usdt
        await deferSwapInstance.dealOrder(1, 1, { from: accounts[3], value: 1 });

        let result = await deferSwapInstance.cancelOrder(1, { from: accounts[2] });

        let log = result.logs[0];
        assert.equal('OrderCancelEvt', log.event);
        assert.equal(ORDER_STATUS.cancel, log.args.status);
        assert.equal(2, log.args.amount0_rem.toString(10));
        assert.equal(6400, log.args.amount1_rem.toString(10));

        // 取消订单，按理应该退回6400usdt
        // 实际消费就是3200usdt
        assert(new BigNumber(1e6).minus(3200).toString(10), new BigNumber(await usdtInstance.balanceOf(accounts[2])).toString(10));
    })

    // ------------ cancelOrder ------

    // ------------ dealOrder ------

    it('dealOrder => fail => order not exists', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        try {
            await deferSwapInstance.dealOrder(1, 3200, { from: accounts[3] });
        } catch (e) {
            assert.equal('DeferSwap: order not exists', e.reason);
        }
    })

    it('cancelOrder => fail => order has cancel', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3200, true, [], { from: accounts[2], value: 1 });

        await usdtInstance.transfer(accounts[3], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[3] });

        await deferSwapInstance.cancelOrder(1, { from: accounts[2] });

        try {
            await deferSwapInstance.dealOrder(1, 3200, { from: accounts[3] });
        } catch (e) {
            assert.equal('DeferSwap: order has cancel/complete', e.reason);
        }
    })

    it('cancelOrder => fail => order has complete', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        // 交易统计
        let mineInstance = await Mine.new({ from: accounts[1] });
        let amountCompInstance = await AmountComp.new({ from: accounts[1] });
        await amountCompInstance.setStableToken(TOKEN_USDT, true, { from: accounts[1] });
        await mineInstance.setAmountCompContract(amountCompInstance.address, { from: accounts[1] });
        await mineInstance.setWriteAddress(deferSwapInstance.address, { from: accounts[1] });
        await deferSwapInstance.setNotifyContract(mineInstance.address, { from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3200, true, [], { from: accounts[2], value: 1 });

        await usdtInstance.transfer(accounts[3], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[3] });

        await deferSwapInstance.dealOrder(1, 3200, { from: accounts[3] });

        try {
            await deferSwapInstance.dealOrder(1, 3200, { from: accounts[2] });
        } catch (e) {
            assert.equal('DeferSwap: order has cancel/complete', e.reason);
        }
    })

    it('dealOrder => success => sell', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        // 交易统计
        let mineInstance = await Mine.new({ from: accounts[1] });
        let amountCompInstance = await AmountComp.new({ from: accounts[1] });
        await amountCompInstance.setStableToken(TOKEN_USDT, true, { from: accounts[1] });
        await mineInstance.setAmountCompContract(amountCompInstance.address, { from: accounts[1] });
        await mineInstance.setWriteAddress(deferSwapInstance.address, { from: accounts[1] });
        await deferSwapInstance.setNotifyContract(mineInstance.address, { from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3200, true, [], { from: accounts[2], value: 1 });

        await usdtInstance.transfer(accounts[3], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[3] });

        let result = await deferSwapInstance.dealOrder(1, 3200, { from: accounts[3] });

        let log = result.logs[0];
        assert.equal('OrderUpdatedEvt', log.event);
        assert.equal(ORDER_STATUS.deal, log.args.status);
        assert.equal(0, log.args.amount0_rem);
        assert.equal(0, log.args.amount1_rem);

        assert.equal(3200, new BigNumber(await usdtInstance.balanceOf(accounts[2])).toString(10));
    });

    it('dealOrder => success => buy', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        // 交易统计
        let mineInstance = await Mine.new({ from: accounts[1] });
        let amountCompInstance = await AmountComp.new({ from: accounts[1] });
        await amountCompInstance.setStableToken(TOKEN_USDT, true, { from: accounts[1] });
        await mineInstance.setAmountCompContract(amountCompInstance.address, { from: accounts[1] });
        await mineInstance.setWriteAddress(deferSwapInstance.address, { from: accounts[1] });
        await deferSwapInstance.setNotifyContract(mineInstance.address, { from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await usdtInstance.transfer(accounts[2], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[2] });

        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3200, false, [], { from: accounts[2] });

        let result = await deferSwapInstance.dealOrder(1, 1, { from: accounts[3], value: 1 });

        let log = result.logs[0];
        assert.equal('OrderUpdatedEvt', log.event);
        assert.equal(ORDER_STATUS.deal, log.args.status);
        assert.equal(0, log.args.amount0_rem);
        assert.equal(0, log.args.amount1_rem);

        assert.equal(3200, new BigNumber(await usdtInstance.balanceOf(accounts[3])).toString(10));
    });

    it('dealOrder => buy => fail', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await usdtInstance.transfer(accounts[2], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[2] });

        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3200, false, [], { from: accounts[2] });

        try {
            await deferSwapInstance.dealOrder(1, 1, { from: accounts[3] });
        } catch (e) {
            assert.equal("DeferSwap: params error.2", e.reason);
        }
    });

    it('dealOrder => success => sell => dealPart', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        // 交易统计
        let mineInstance = await Mine.new({ from: accounts[1] });
        let amountCompInstance = await AmountComp.new({ from: accounts[1] });
        await amountCompInstance.setStableToken(TOKEN_USDT, true, { from: accounts[1] });
        await mineInstance.setAmountCompContract(amountCompInstance.address, { from: accounts[1] });
        await mineInstance.setWriteAddress(deferSwapInstance.address, { from: accounts[1] });
        await deferSwapInstance.setNotifyContract(mineInstance.address, { from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 10, 32000, true, [], { from: accounts[2], value: 10 });

        await usdtInstance.transfer(accounts[3], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[3] });

        let result = await deferSwapInstance.dealOrder(1, 16000, { from: accounts[3] });

        let log = result.logs[0];
        assert.equal('OrderUpdatedEvt', log.event);
        assert.equal(ORDER_STATUS.part, log.args.status);
        assert.equal(5, log.args.amount0_rem.toString(10));
        assert.equal(16000, log.args.amount1_rem.toString(10));

        assert.equal(16000, new BigNumber(await usdtInstance.balanceOf(accounts[2])).toString(10));
    });

    it('dealOrder => success => buy => dealPart', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        // 交易统计
        let mineInstance = await Mine.new({ from: accounts[1] });
        let amountCompInstance = await AmountComp.new({ from: accounts[1] });
        await amountCompInstance.setStableToken(TOKEN_USDT, true, { from: accounts[1] });
        await mineInstance.setAmountCompContract(amountCompInstance.address, { from: accounts[1] });
        await mineInstance.setWriteAddress(deferSwapInstance.address, { from: accounts[1] });
        await deferSwapInstance.setNotifyContract(mineInstance.address, { from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await usdtInstance.transfer(accounts[2], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[2] });

        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 10, 32000, false, [], { from: accounts[2] });

        let result = await deferSwapInstance.dealOrder(1, 1, { from: accounts[3], value: 1 });

        let log = result.logs[0];
        assert.equal('OrderUpdatedEvt', log.event);
        assert.equal(ORDER_STATUS.part, log.args.status);
        assert.equal(9, log.args.amount0_rem.toString(10));
        assert.equal(28800, log.args.amount1_rem.toString(10));

        assert.equal(3200, new BigNumber(await usdtInstance.balanceOf(accounts[3])).toString(10));
    });

    // ------------ dealOrder ------

    // ------------ mergeOrder ------

    it('mergeOrder => fail => params error', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 5, 16000, true, [], { from: accounts[3], value: 5 });

        try {
            await deferSwapInstance.mergeOrder(1, []);
        } catch (e) {
            assert.equal("DeferSwap: params error", e.reason);
        }
    });

    it('mergeOrder => fail => order not exists', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        try {
            await deferSwapInstance.mergeOrder(1, [123]);
        } catch (e) {
            assert.equal("DeferSwap: order not exists", e.reason);
        }
    });

    it('mergeOrder => fail => order has cancel', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3200, true, [], { from: accounts[2], value: 1 });

        await deferSwapInstance.cancelOrder(1, { from: accounts[2] });

        try {
            await deferSwapInstance.mergeOrder(1, [1]);
        } catch (e) {
            assert.equal("DeferSwap: order has cancel/deal", e.reason);
        }
    });

    it('mergeOrder => fail => order has deal', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        // 交易统计
        let mineInstance = await Mine.new({ from: accounts[1] });
        let amountCompInstance = await AmountComp.new({ from: accounts[1] });
        await amountCompInstance.setStableToken(TOKEN_USDT, true, { from: accounts[1] });
        await mineInstance.setAmountCompContract(amountCompInstance.address, { from: accounts[1] });
        await mineInstance.setWriteAddress(deferSwapInstance.address, { from: accounts[1] });
        await deferSwapInstance.setNotifyContract(mineInstance.address, { from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await usdtInstance.transfer(accounts[2], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[2] });

        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3200, false, [], { from: accounts[2] });

        await deferSwapInstance.dealOrder(1, 1, { from: accounts[3], value: 1 });

        try {
            await deferSwapInstance.mergeOrder(1, [1]);
        } catch (e) {
            assert.equal("DeferSwap: order has cancel/deal", e.reason);
        }
    });

    it('mergeOrder => success => buy/sell', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        // 交易统计
        let mineInstance = await Mine.new({ from: accounts[1] });
        let amountCompInstance = await AmountComp.new({ from: accounts[1] });
        await amountCompInstance.setStableToken(TOKEN_USDT, true, { from: accounts[1] });
        await mineInstance.setAmountCompContract(amountCompInstance.address, { from: accounts[1] });
        await mineInstance.setWriteAddress(deferSwapInstance.address, { from: accounts[1] });
        await deferSwapInstance.setNotifyContract(mineInstance.address, { from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await usdtInstance.transfer(accounts[2], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[2] });

        // 买单
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 10, 32000, false, [], { from: accounts[2] });

        // 卖单
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 5, 16000, true, [], { from: accounts[3], value: 5 });

        let result = await deferSwapInstance.mergeOrder(1, [2]);

        let logs = result.logs;
        assert.equal('OrderUpdatedEvt', logs[0].event);
        assert.equal(ORDER_STATUS.deal, logs[0].args.status);
        assert.equal(0, logs[0].args.amount0_rem.toString(10));
        assert.equal(0, logs[0].args.amount1_rem.toString(10));

        assert.equal('OrderUpdatedEvt', logs[1].event);
        assert.equal(ORDER_STATUS.part, logs[1].args.status);
        assert.equal(5, logs[1].args.amount0_rem.toString(10));
        assert.equal(16000, logs[1].args.amount1_rem.toString(10));

        assert.equal(16000, new BigNumber(await usdtInstance.balanceOf(accounts[3])).toString(10));
    });

    it('mergeOrder => success => sell/buy', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        // 交易统计
        let mineInstance = await Mine.new({ from: accounts[1] });
        let amountCompInstance = await AmountComp.new({ from: accounts[1] });
        await amountCompInstance.setStableToken(TOKEN_USDT, true, { from: accounts[1] });
        await mineInstance.setAmountCompContract(amountCompInstance.address, { from: accounts[1] });
        await mineInstance.setWriteAddress(deferSwapInstance.address, { from: accounts[1] });
        await deferSwapInstance.setNotifyContract(mineInstance.address, { from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await usdtInstance.transfer(accounts[2], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[2] });

        // 买单
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 10, 32000, false, [], { from: accounts[2] });

        // 卖单
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 5, 16000, true, [], { from: accounts[3], value: 5 });

        let result = await deferSwapInstance.mergeOrder(2, [1]);

        let logs = result.logs;
        assert.equal('OrderUpdatedEvt', logs[0].event);
        assert.equal(ORDER_STATUS.deal, logs[0].args.status);
        assert.equal(0, logs[0].args.amount0_rem.toString(10));
        assert.equal(0, logs[0].args.amount1_rem.toString(10));

        assert.equal('OrderUpdatedEvt', logs[1].event);
        assert.equal(ORDER_STATUS.part, logs[1].args.status);
        assert.equal(5, logs[1].args.amount0_rem.toString(10));
        assert.equal(16000, logs[1].args.amount1_rem.toString(10));

        assert.equal(16000, new BigNumber(await usdtInstance.balanceOf(accounts[3])).toString(10));
    });

    it('mergeOrder => success => sell/buy => multi', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        // 交易统计
        let mineInstance = await Mine.new({ from: accounts[1] });
        let amountCompInstance = await AmountComp.new({ from: accounts[1] });
        await amountCompInstance.setStableToken(TOKEN_USDT, true, { from: accounts[1] });
        await mineInstance.setAmountCompContract(amountCompInstance.address, { from: accounts[1] });
        await mineInstance.setWriteAddress(deferSwapInstance.address, { from: accounts[1] });
        await deferSwapInstance.setNotifyContract(mineInstance.address, { from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await usdtInstance.transfer(accounts[2], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[2] });

        await usdtInstance.transfer(accounts[4], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[4] });

        // 买单
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 10, 32000, false, [], { from: accounts[2] });
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3300, false, [], { from: accounts[4] });

        // 卖单
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 15, 48000, true, [], { from: accounts[3], value: 15 });

        let result = await deferSwapInstance.mergeOrder(3, [1, 2]);

        let logs = result.logs;
        assert.equal('OrderUpdatedEvt', logs[0].event);
        assert.equal(ORDER_STATUS.part, logs[0].args.status);
        assert.equal(5, logs[0].args.amount0_rem.toString(10));
        assert.equal(16000, logs[0].args.amount1_rem.toString(10));

        assert.equal('OrderUpdatedEvt', logs[1].event);
        assert.equal(ORDER_STATUS.deal, logs[1].args.status);
        assert.equal(0, logs[1].args.amount0_rem.toString(10));
        assert.equal(0, logs[1].args.amount1_rem.toString(10));

        assert.equal('OrderUpdatedEvt', logs[3].event);
        assert.equal(ORDER_STATUS.part, logs[3].args.status);
        assert.equal(4, logs[3].args.amount0_rem.toString(10));
        assert.equal(12800, logs[3].args.amount1_rem.toString(10));

        assert.equal('OrderUpdatedEvt', logs[4].event);
        assert.equal(ORDER_STATUS.deal, logs[4].args.status);
        assert.equal(0, logs[4].args.amount0_rem.toString(10));
        assert.equal(0, logs[4].args.amount1_rem.toString(10));

        // 虽然挂单3300，但是3200成交的
        // 交易结束退还100usdt
        assert.equal(new BigNumber(1e6).minus(3200).toString(10), new BigNumber(await usdtInstance.balanceOf(accounts[4])).toString(10));
    });

    it('mergeOrder => sell/buy => fail => sellPrice gt buyPrice', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await usdtInstance.transfer(accounts[2], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[2] });

        await usdtInstance.transfer(accounts[4], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[4] });

        // 买单
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 10, 1500, false, [], { from: accounts[2] });
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3300, false, [], { from: accounts[4] });

        // 卖单
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 15, 48000, true, [], { from: accounts[3], value: 15 });

        try {
            await deferSwapInstance.mergeOrder(3, [1, 2]);
        } catch (e) {
            assert.equal("DeferSwap: params error.3", e.reason);
        }
    });

    it('mergeOrder => buy/sell => fail => buyPrice lt sellPrice', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await usdtInstance.transfer(accounts[2], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[2] });

        await usdtInstance.transfer(accounts[4], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[4] });

        // 买单
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 10, 32000, false, [], { from: accounts[2] });
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3300, false, [], { from: accounts[4] });

        // 卖单
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 4000, true, [], { from: accounts[3], value: 1 });

        try {
            await deferSwapInstance.mergeOrder(1, [3]);
        } catch (e) {
            assert.equal("DeferSwap: params error.3", e.reason);
        }
    });

    it('mergeOrder => sell/buy => fail => order not exists', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await usdtInstance.transfer(accounts[2], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[2] });

        await usdtInstance.transfer(accounts[4], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[4] });

        // 买单
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 10, 1500, false, [], { from: accounts[2] });
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3300, false, [], { from: accounts[4] });

        // 卖单
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 15, 48000, true, [], { from: accounts[3], value: 15 });

        try {
            await deferSwapInstance.mergeOrder(110, [1, 2]);
        } catch (e) {
            assert.equal("DeferSwap: order not exists", e.reason);
        }
    });

    it('mergeOrder => sell/buy => fail => order has cancel', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await usdtInstance.transfer(accounts[2], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[2] });

        await usdtInstance.transfer(accounts[4], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[4] });

        // 买单
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 10, 1500, false, [], { from: accounts[2] });
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3300, false, [], { from: accounts[4] });

        // 卖单
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 15, 48000, true, [], { from: accounts[3], value: 15 });

        await deferSwapInstance.cancelOrder(3, { from: accounts[3] });

        try {
            await deferSwapInstance.mergeOrder(3, [1, 2]);
        } catch (e) {
            assert.equal("DeferSwap: order has cancel/deal", e.reason);
        }
    });

    it('mergeOrder => sell/buy => fail => pair not equal', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });
        let daiInstance = await DaiToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_DAI, 18, daiInstance.address, { from: accounts[1] });

        await daiInstance.transfer(accounts[2], 1e6, { from: accounts[1] });
        await daiInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[2] });

        await usdtInstance.transfer(accounts[4], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[4] });

        // 买单
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_DAI, 10, 1500, false, [], { from: accounts[2] });
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3300, false, [], { from: accounts[4] });

        // 卖单
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 15, 48000, true, [], { from: accounts[3], value: 15 });

        try {
            await deferSwapInstance.mergeOrder(3, [1, 2]);
        } catch (e) {
            assert.equal("DeferSwap: params error.2", e.reason);
        }
    });

    it('mergeOrder => sell/buy => fail => sell too', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        await usdtInstance.transfer(accounts[2], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[2] });

        await usdtInstance.transfer(accounts[4], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[4] });

        // 买单
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 10, 1500, true, [], { from: accounts[2], value: 10 });
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1, 3300, false, [], { from: accounts[4] });

        // 卖单
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 15, 48000, true, [], { from: accounts[3], value: 15 });

        try {
            await deferSwapInstance.mergeOrder(3, [1, 2]);
        } catch (e) {
            assert.equal("DeferSwap: params error.2", e.reason);
        }
    });

    // ------------ mergeOrder ------

    // ------------ fee ------

    it('fee => sell', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        // 交易统计
        let mineInstance = await Mine.new({ from: accounts[1] });
        let amountCompInstance = await AmountComp.new({ from: accounts[1] });
        await amountCompInstance.setStableToken(TOKEN_USDT, true, { from: accounts[1] });
        await mineInstance.setAmountCompContract(amountCompInstance.address, { from: accounts[1] });
        await mineInstance.setWriteAddress(deferSwapInstance.address, { from: accounts[1] });
        await deferSwapInstance.setNotifyContract(mineInstance.address, { from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        //setFee
        await deferSwapInstance.setFee(50, { from: accounts[1] });
        await deferSwapInstance.setFeeAddress(accounts[8], { from: accounts[1] });

        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1000, 3200, true, [], { from: accounts[2], value: 1000 });

        await usdtInstance.transfer(accounts[3], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[3] });

        let a8Balance = await web3.eth.getBalance(accounts[8]);

        await deferSwapInstance.dealOrder(1, 3200, { from: accounts[3] });

        // 收到5wei手续费
        assert.equal(new BigNumber(a8Balance).plus(5).toString(10), await web3.eth.getBalance(accounts[8]));
        // 收到16usdt手续费
        assert.equal(16, new BigNumber(await usdtInstance.balanceOf(accounts[8])).toString(10));

        // 购买者实际到账3200-16
        assert.equal(3184, new BigNumber(await usdtInstance.balanceOf(accounts[2])).toString(10));
    });

    it('fee => buy', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        // 交易统计
        let mineInstance = await Mine.new({ from: accounts[1] });
        let amountCompInstance = await AmountComp.new({ from: accounts[1] });
        await amountCompInstance.setStableToken(TOKEN_USDT, true, { from: accounts[1] });
        await mineInstance.setAmountCompContract(amountCompInstance.address, { from: accounts[1] });
        await mineInstance.setWriteAddress(deferSwapInstance.address, { from: accounts[1] });
        await deferSwapInstance.setNotifyContract(mineInstance.address, { from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        //setFee
        await deferSwapInstance.setFee(50, { from: accounts[1] });
        await deferSwapInstance.setFeeAddress(accounts[8], { from: accounts[1] });

        await usdtInstance.transfer(accounts[2], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[2] });

        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 1000, 3200, false, [], { from: accounts[2] });

        let a8Balance = await web3.eth.getBalance(accounts[8]);

        await deferSwapInstance.dealOrder(1, 1000, { from: accounts[3], value: 1000 });

        // 收到5wei手续费
        assert.equal(new BigNumber(a8Balance).plus(5).toString(10), await web3.eth.getBalance(accounts[8]));
        // 收到16usdt手续费
        assert.equal(16, new BigNumber(await usdtInstance.balanceOf(accounts[8])).toString(10));

        // 购买者实际到账3200-16
        assert.equal(3184, new BigNumber(await usdtInstance.balanceOf(accounts[3])).toString(10));
    });

    it('fee => sell => dealPart', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        // 交易统计
        let mineInstance = await Mine.new({ from: accounts[1] });
        let amountCompInstance = await AmountComp.new({ from: accounts[1] });
        await amountCompInstance.setStableToken(TOKEN_USDT, true, { from: accounts[1] });
        await mineInstance.setAmountCompContract(amountCompInstance.address, { from: accounts[1] });
        await mineInstance.setWriteAddress(deferSwapInstance.address, { from: accounts[1] });
        await deferSwapInstance.setNotifyContract(mineInstance.address, { from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        //setFee
        await deferSwapInstance.setFee(50, { from: accounts[1] });
        await deferSwapInstance.setFeeAddress(accounts[8], { from: accounts[1] });

        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 2000, 3200, true, [], { from: accounts[2], value: 2000 });

        await usdtInstance.transfer(accounts[3], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e6, { from: accounts[3] });

        let a8Balance = await web3.eth.getBalance(accounts[8]);

        await deferSwapInstance.dealOrder(1, 1600, { from: accounts[3] });

        // 收到5wei手续费
        assert.equal(new BigNumber(a8Balance).plus(5).toString(10), await web3.eth.getBalance(accounts[8]));
        // 收到16usdt手续费
        assert.equal(8, new BigNumber(await usdtInstance.balanceOf(accounts[8])).toString(10));

        // 购买者实际到账3200-16
        assert.equal(1592, new BigNumber(await usdtInstance.balanceOf(accounts[2])).toString(10));
    });

    it('fee => createOrder => sell => dealPart', async () => {
        let deferSwapInstance = await DeferSwap.new({ from: accounts[1] });
        let usdtInstance = await UsdtToken.new({ from: accounts[1] });

        // 交易统计
        let mineInstance = await Mine.new({ from: accounts[1] });
        let amountCompInstance = await AmountComp.new({ from: accounts[1] });
        await amountCompInstance.setStableToken(TOKEN_USDT, true, { from: accounts[1] });
        await mineInstance.setAmountCompContract(amountCompInstance.address, { from: accounts[1] });
        await mineInstance.setWriteAddress(deferSwapInstance.address, { from: accounts[1] });
        await deferSwapInstance.setNotifyContract(mineInstance.address, { from: accounts[1] });

        await deferSwapInstance.setToken(TOKEN_ETH, 18, ADDRESS0, { from: accounts[1] });
        await deferSwapInstance.setToken(TOKEN_USDT, 18, usdtInstance.address, { from: accounts[1] });

        //setFee
        await deferSwapInstance.setFee(50, { from: accounts[1] });
        await deferSwapInstance.setFeeAddress(accounts[8], { from: accounts[1] });

        await usdtInstance.transfer(accounts[3], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e10, { from: accounts[3] });

        await usdtInstance.transfer(accounts[4], 1e6, { from: accounts[1] });
        await usdtInstance.approve(deferSwapInstance.address, 1e10, { from: accounts[4] });

        // 手续费 -> 150wei
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 30000, 120000, false, [], { from: accounts[3] });

        // 手续费 -> 200wei
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 40000, 150000, false, [], { from: accounts[4] });

        let a8Balance = await web3.eth.getBalance(accounts[8]);

        // 部分成交 => 手续费 -> 1120usdt
        await deferSwapInstance.createOrder(TOKEN_ETH, TOKEN_USDT, 100000, 320000, true, [1, 2], { from: accounts[2], value: 100000 });

        assert.equal(new BigNumber(a8Balance).plus(350).toString(10), new BigNumber(await web3.eth.getBalance(accounts[8])).toString());

        assert.equal(1120, new BigNumber(await usdtInstance.balanceOf(accounts[8])).toString());
    })

    // ------------ fee ------
});


