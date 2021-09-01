// SPDX-License-Identifier: APACHE-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./NotifyInterface.sol";

contract DeferSwap is Ownable, ReentrancyGuard {
    uint8 constant STATUS_DEFAULT = 0;
    uint8 constant STATUS_CANCEL = 5;
    uint8 constant STATUS_PART = 7;
    uint8 constant STATUS_DEAL = 9;

    uint256 constant PRICE_DECIMAL = 100000000;

    struct OrderModel {
        uint256 order_no;
        address payable owner;
        string pair0;
        string pair1;
        uint256 amount0;
        uint256 amount1;
        uint256 amount0_rem;
        uint256 amount1_rem;
        bool is_sell;
        uint256 price;
        uint8 status;
    }

    struct DealRecordModel {
        uint256 id;
        uint256 sell_order_no;
        uint256 buy_order_no;
        uint256 amount0;
        uint256 amount1;
        address payable submitter;
    }

    struct TokenModel {
        string name;
        uint256 decimal;
        IERC20 dist;
    }

    uint256 public orderTotal;
    mapping(uint256 => OrderModel) public orders;

    uint256 public dealRecordTotal;
    mapping(uint256 => DealRecordModel) public dealRecords;

    mapping(uint256 => uint256[]) public orderDealRecords;

    mapping(string => TokenModel) public tokens;

    uint256 public fee;

    address payable public feeAddress;

    NotifyInterface notifyContract;

    event OrderCreatedEvt(
        uint256 order_no,
        address owner,
        string pair0,
        string pair1,
        uint256 amount0,
        uint256 amount1,
        uint256 amount0_rem,
        uint256 amount1_rem,
        bool is_sell,
        uint256 price,
        uint8 status
    );
    event OrderCancelEvt(
        uint256 order_no,
        uint256 amount0_rem,
        uint256 amount1_rem,
        uint8 status
    );
    event OrderUpdatedEvt(
        uint256 order_no,
        uint256 amount0_rem,
        uint256 amount1_rem,
        uint8 status
    );
    event DealEvt(
        string pair0,
        string pair1,
        uint256 amount0,
        uint256 amount1,
        address seller,
        address buyer
    );

    function setFee(uint256 _fee) public onlyOwner {
        fee = _fee;
    }

    function setFeeAddress(address payable _address) public onlyOwner {
        feeAddress = _address;
    }

    function setToken(
        string memory _name,
        uint256 _decimal,
        IERC20 _tokenAddress
    ) public onlyOwner {
        tokens[_name] = TokenModel(_name, _decimal, _tokenAddress);
    }

    function setNotifyContract(NotifyInterface _address) public onlyOwner {
        notifyContract = _address;
    }

    function createOrder(
        string memory _pair0,
        string memory _pair1,
        uint256 _amount0,
        uint256 _amount1,
        bool _isSell,
        uint256[] memory _orderIds
    ) public payable nonReentrant {
        require(_amount0 > 0 && _amount1 > 0, "DeferSwap: params error.1");
        require(
            tokens[_pair0].decimal != 0 && tokens[_pair1].decimal != 0,
            "DeferSwap: token unsupport"
        );
        require(!_tokenEqual(_pair0, _pair1), "DeferSwap: params error.2");

        uint256 _price = (_amount1 * PRICE_DECIMAL) / _amount0;

        for (uint256 i = 0; i < _orderIds.length; i++) {
            uint256 _tmpOrderNo = _orderIds[i];
            require(
                orders[_tmpOrderNo].order_no != 0 &&
                    (orders[_tmpOrderNo].status == STATUS_DEFAULT ||
                        orders[_tmpOrderNo].status == STATUS_PART) &&
                    orders[_tmpOrderNo].is_sell != _isSell &&
                    _tokenEqual(_pair0, orders[_tmpOrderNo].pair0) &&
                    _tokenEqual(_pair1, orders[_tmpOrderNo].pair1),
                "DeferSwap: params error.3"
            );
            if (_isSell) {
                require(
                    orders[_tmpOrderNo].price >= _price,
                    "DeferSwap: params error.5"
                );
            } else {
                require(
                    orders[_tmpOrderNo].price <= _price,
                    "DeferSwap: params error.5"
                );
            }
        }

        string memory _payToken = _isSell ? _pair0 : _pair1;
        uint256 _payAmount = _isSell ? _amount0 : _amount1;

        if (_isEth(_payToken)) {
            require(_payAmount == msg.value, "DeferSwap: params error.4");
        } else {
            tokens[_payToken].dist.transferFrom(
                _msgSender(),
                address(this),
                _payAmount
            );
        }

        orderTotal++;
        OrderModel memory _order = OrderModel(
            orderTotal,
            payable(_msgSender()),
            _pair0,
            _pair1,
            _amount0,
            _amount1,
            _amount0,
            _amount1,
            _isSell,
            _price,
            STATUS_DEFAULT
        );
        orders[orderTotal] = _order;

        emit OrderCreatedEvt(
            _order.order_no,
            _order.owner,
            _order.pair0,
            _order.pair1,
            _order.amount0,
            _order.amount1,
            _order.amount0_rem,
            _order.amount1_rem,
            _order.is_sell,
            _order.price,
            _order.status
        );

        for (uint256 i = 0; i < _orderIds.length; i++) {
            uint256 _tmpOrderNo = _orderIds[i];
            bool _isContinue = false;
            if (_order.is_sell) {
                _isContinue = _match(_order.order_no, _tmpOrderNo);
            } else {
                _isContinue = _match(_tmpOrderNo, _order.order_no);
            }

            if (_isContinue == false) {
                break;
            }
        }
    }

    function cancelOrder(uint256 _orderNo) public nonReentrant {
        OrderModel memory _order = orders[_orderNo];
        require(_order.order_no != 0, "DeferSwap: order not exists");
        require(_order.owner == _msgSender(), "DeferSwap: unauthorized");
        require(
            _order.status == STATUS_DEFAULT || _order.status == STATUS_PART,
            "DeferSwap: order has cancel/complete"
        );

        string memory _payToken = _order.is_sell ? _order.pair0 : _order.pair1;
        uint256 _payAmount = _order.is_sell
            ? _order.amount0_rem
            : _order.amount1_rem;

        orders[_orderNo].status = STATUS_CANCEL;

        if (_payAmount > 0) {
            if (_isEth(_payToken)) {
                _order.owner.transfer(_payAmount);
            } else {
                tokens[_payToken].dist.transfer(_order.owner, _payAmount);
            }
        }

        emit OrderCancelEvt(
            _order.order_no,
            orders[_order.order_no].amount0_rem,
            orders[_order.order_no].amount1_rem,
            orders[_order.order_no].status
        );
    }

    function dealOrder(uint256 _orderNo, uint256 _amount)
        public
        payable
        nonReentrant
    {
        OrderModel memory _order = orders[_orderNo];
        require(_order.order_no != 0, "DeferSwap: order not exists");
        require(
            _order.status == STATUS_DEFAULT || _order.status == STATUS_PART,
            "DeferSwap: order has cancel/complete"
        );

        string memory _dealToken = _order.is_sell ? _order.pair1 : _order.pair0;
        uint256 _dealAmount = _order.is_sell
            ? _order.amount1_rem
            : _order.amount0_rem;

        require(_amount <= _dealAmount, "DeferSwap: params error.1");

        address payable _buyerAddress = payable(_msgSender());

        if (_isEth(_dealToken)) {
            require(_amount == msg.value, "DeferSwap: params error.2");
        } else {
            tokens[_dealToken].dist.transferFrom(
                _buyerAddress,
                address(this),
                _amount
            );
        }

        DealRecordModel memory _dealRecord;

        if (_order.is_sell) {
            _dealRecord = DealRecordModel(
                dealRecordTotal,
                _order.order_no,
                0,
                (_amount * _order.amount0_rem) / _order.amount1_rem,
                _amount,
                _buyerAddress
            );
        } else {
            _dealRecord = DealRecordModel(
                dealRecordTotal,
                0,
                _order.order_no,
                _amount,
                (_amount * _order.amount1_rem) / _order.amount0_rem,
                _buyerAddress
            );
        }

        dealRecords[_dealRecord.id] = _dealRecord;
        dealRecordTotal++;

        orderDealRecords[_orderNo].push(_dealRecord.id);

        orders[_order.order_no].amount0_rem -= _dealRecord.amount0;
        orders[_order.order_no].amount1_rem -= _dealRecord.amount1;
        orders[_order.order_no].status = orders[_order.order_no].amount0_rem ==
            0 ||
            orders[_order.order_no].amount1_rem == 0
            ? STATUS_DEAL
            : STATUS_PART;

        string memory _orderOwnerReceiveToken;
        uint256 _orderOwnerReceiveAmount;

        string memory _buyerReceiveToken;
        uint256 _buyerReceiveAmount;

        if (_order.is_sell) {
            _orderOwnerReceiveToken = _order.pair1;
            _orderOwnerReceiveAmount = _dealRecord.amount1;

            _buyerReceiveToken = _order.pair0;
            _buyerReceiveAmount = _dealRecord.amount0;
        } else {
            _orderOwnerReceiveToken = _order.pair0;
            _orderOwnerReceiveAmount = _dealRecord.amount0;

            _buyerReceiveToken = _order.pair1;
            _buyerReceiveAmount = _dealRecord.amount1;
        }

        _orderTransferHandle(
            _orderOwnerReceiveToken,
            _order.owner,
            _orderOwnerReceiveAmount,
            _compFee(_orderOwnerReceiveAmount)
        );

        _orderTransferHandle(
            _buyerReceiveToken,
            _buyerAddress,
            _buyerReceiveAmount,
            _compFee(_buyerReceiveAmount)
        );

        notifyContract.notify(_order.pair1, _dealRecord.amount1, _order.owner);
        notifyContract.notify(_order.pair1, _dealRecord.amount1, _buyerAddress);

        emit OrderUpdatedEvt(
            _order.order_no,
            orders[_order.order_no].amount0_rem,
            orders[_order.order_no].amount1_rem,
            orders[_order.order_no].status
        );

        emit DealEvt(
            _order.pair0,
            _order.pair1,
            _dealRecord.amount0,
            _dealRecord.amount1,
            _order.owner,
            _buyerAddress
        );
    }

    function mergeOrder(uint256 _orderNo, uint256[] memory _orderIds)
        public
        nonReentrant
    {
        require(_orderIds.length > 0, "DeferSwap: params error");

        OrderModel memory _order = orders[_orderNo];
        require(_order.order_no != 0, "DeferSwap: order not exists");
        require(
            _order.status == STATUS_DEFAULT || _order.status == STATUS_PART,
            "DeferSwap: order has cancel/deal"
        );

        for (uint256 i = 0; i < _orderIds.length; i++) {
            uint256 _tmpOrderNo = _orderIds[i];
            require(
                orders[_tmpOrderNo].order_no != 0 &&
                    (orders[_tmpOrderNo].status == STATUS_DEFAULT ||
                        orders[_tmpOrderNo].status == STATUS_PART) &&
                    orders[_tmpOrderNo].is_sell != _order.is_sell &&
                    _tokenEqual(orders[_tmpOrderNo].pair0, _order.pair0) &&
                    _tokenEqual(orders[_tmpOrderNo].pair1, _order.pair1),
                "DeferSwap: params error.2"
            );
            if (_order.is_sell) {
                require(
                    orders[_tmpOrderNo].price >= _order.price,
                    "DeferSwap: params error.3"
                );
            } else {
                require(
                    orders[_tmpOrderNo].price <= _order.price,
                    "DeferSwap: params error.3"
                );
            }
        }

        for (uint256 i = 0; i < _orderIds.length; i++) {
            uint256 _tmpOrderNo = _orderIds[i];
            bool _isContinue = false;

            if (_order.is_sell) {
                _isContinue = _match(_order.order_no, _tmpOrderNo);
            } else {
                _isContinue = _match(_tmpOrderNo, _order.order_no);
            }

            if (_isContinue == false) {
                break;
            }
        }
    }

    function _match(uint256 _sellOrderNo, uint256 _buyOrderNo)
        internal
        returns (bool)
    {
        OrderModel memory _sellOrder = orders[_sellOrderNo];
        OrderModel memory _buyOrder = orders[_buyOrderNo];

        if (
            _sellOrder.amount0_rem == 0 ||
            _sellOrder.amount1_rem == 0 ||
            _buyOrder.amount0_rem == 0 ||
            _buyOrder.amount1_rem == 0
        ) {
            return false;
        }

        uint256 _amount0 = _sellOrder.amount0_rem > _buyOrder.amount0_rem
            ? _buyOrder.amount0_rem
            : _sellOrder.amount0_rem;

        uint256 _sellAmount1 = (_amount0 * _sellOrder.amount1_rem) /
            _sellOrder.amount0_rem;
        uint256 _buyAmount1 = (_amount0 * _buyOrder.amount1_rem) /
            _buyOrder.amount0_rem;

        uint256 _amount1 = _sellAmount1;
        uint256 _buyAmountOver = _buyAmount1 > _amount1
            ? _buyAmount1 - _amount1
            : 0;

        DealRecordModel memory _dealRecord = DealRecordModel(
            dealRecordTotal,
            _sellOrder.order_no,
            _buyOrder.order_no,
            _amount0,
            _amount1,
            payable(address(0))
        );

        orderDealRecords[_sellOrder.order_no].push(_dealRecord.id);
        orderDealRecords[_buyOrder.order_no].push(_dealRecord.id);

        orders[_sellOrder.order_no].amount0_rem -= _dealRecord.amount0;
        orders[_sellOrder.order_no].amount1_rem -= _sellAmount1;
        orders[_sellOrder.order_no].status = orders[_sellOrder.order_no]
            .amount0_rem == 0
            ? STATUS_DEAL
            : STATUS_PART;

        orders[_buyOrder.order_no].amount0_rem -= _dealRecord.amount0;
        orders[_buyOrder.order_no].amount1_rem -= _buyAmount1;
        orders[_buyOrder.order_no].status = orders[_buyOrder.order_no]
            .amount0_rem == 0
            ? STATUS_DEAL
            : STATUS_PART;

        _orderTransferHandle(
            _sellOrder.pair1,
            _sellOrder.owner,
            _dealRecord.amount1,
            _compFee(_dealRecord.amount1)
        );

        _orderTransferHandle(
            _buyOrder.pair0,
            _buyOrder.owner,
            _dealRecord.amount0,
            _compFee(_dealRecord.amount0)
        );

        if (_buyAmountOver > 0) {
            _orderTransferHandle(
                _buyOrder.pair1,
                _buyOrder.owner,
                _buyAmountOver,
                0
            );
        }

        emit OrderUpdatedEvt(
            _sellOrder.order_no,
            orders[_sellOrder.order_no].amount0_rem,
            orders[_sellOrder.order_no].amount1_rem,
            orders[_sellOrder.order_no].status
        );
        emit OrderUpdatedEvt(
            _buyOrder.order_no,
            orders[_buyOrder.order_no].amount0_rem,
            orders[_buyOrder.order_no].amount1_rem,
            orders[_buyOrder.order_no].status
        );

        emit DealEvt(
            _sellOrder.pair0,
            _sellOrder.pair1,
            _dealRecord.amount0,
            _dealRecord.amount1,
            _sellOrder.owner,
            _buyOrder.owner
        );

        notifyContract.notify(
            _sellOrder.pair1,
            _dealRecord.amount1,
            _sellOrder.owner
        );
        notifyContract.notify(
            _buyOrder.pair1,
            _dealRecord.amount1,
            _buyOrder.owner
        );

        return true;
    }

    function _orderTransferHandle(
        string memory _token,
        address payable _owner,
        uint256 _amount,
        uint256 _fee
    ) internal {
        uint256 _realAmount = _amount - _fee;

        if (_isEth(_token)) {
            _owner.transfer(_realAmount);
            if (_fee > 0) {
                feeAddress.transfer(_fee);
            }
        } else {
            _tokenTransfer(_token, _owner, _realAmount);
            if (_fee > 0) {
                _tokenTransfer(_token, feeAddress, _fee);
            }
        }
    }

    function _tokenEqual(string memory _t1, string memory _t2)
        internal
        view
        returns (bool)
    {
        return address(tokens[_t1].dist) == address(tokens[_t2].dist);
    }

    function _tokenTransfer(
        string memory _token,
        address _receive,
        uint256 _amount
    ) internal {
        tokens[_token].dist.transfer(_receive, _amount);
    }

    function _compFee(uint256 _amount) internal view returns (uint256) {
        if (fee == 0) {
            return 0;
        }

        return (_amount * fee) / 10000;
    }

    function _isEth(string memory _token) internal view returns (bool) {
        return address(tokens[_token].dist) == address(0);
    }
}
