// SPDX-License-Identifier: APACHE-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./NotifyInterface.sol";
import "./AmountCompInterface.sol";

contract Mine is NotifyInterface, Ownable, ReentrancyGuard {
    // 交易额写入地址
    address public writeAddress;

    // DEFER 开始释放区块
    uint256 public startBlock;
    uint256 public endBlock;
    uint256 public lastBlock;

    // 每个区块释放defer数量
    uint256 public perBlockDefer = 20;

    // Defer代币合约地址
    IERC20 DeferToken;

    // token白名单[决定什么token可计入挖矿]
    mapping(string => bool) public tokenWhitelist;

    // 用户交易额
    mapping(address => uint256) public addressVolume;

    // 用户DEFER抵押
    mapping(address => uint256) public addressDeposit;

    // 抵押总额
    uint256 public depositTotal;

    // 用户最近提现时间
    mapping(address => uint256) public addressLastWithdrawAt;

    // 提现限制[默认30天]
    uint256 public withdrawLimit = 2592000;

    // 用户得分
    mapping(address => uint256) public addressScore;

    // 总分
    uint256 public scoreTotal;

    // 已释放DEFER总量
    uint256 public deferTotal;

    // 交易量计算合约
    AmountCompInterface amountCompContract;

    function setToken(string memory _token, bool _status) public onlyOwner {
        tokenWhitelist[_token] = _status;
    }

    function setStartBlock(uint256 _start, uint256 _end) public onlyOwner {
        require(_end > _start, "Mine: params error");
        startBlock = _start;
        endBlock = _end;
        lastBlock = startBlock;
    }

    function setPerBlockDefer(uint256 _num) public onlyOwner {
        perBlockDefer = _num;
    }

    function setWriteAddress(address _address) public onlyOwner {
        writeAddress = _address;
    }

    function setDeferToken(IERC20 _tokenAddress) public onlyOwner {
        DeferToken = _tokenAddress;
    }

    function setWithdrawLimit(uint256 _limit) public onlyOwner {
        withdrawLimit = _limit;
    }

    function setAmountCompContract(AmountCompInterface _address)
        public
        onlyOwner
    {
        amountCompContract = _address;
    }

    function emergencyWithdraw(uint256 _amount) public onlyOwner {
        require(_amount > 0, "Mine: params error");
        DeferToken.transfer(_msgSender(), _amount);
    }

    function notify(
        string memory _pair1,
        uint256 _amount1,
        address _owner
    ) external override nonReentrant {
        _deferMine();

        require(_amount1 > 0, "Mine: params error");
        require(_msgSender() == writeAddress, "Mine: Permission denied");

        // 非白名单token
        if (tokenWhitelist[_pair1] == false) {
            return;
        }

        // 地址交易额累计
        addressVolume[_owner] += amountCompContract.amount(_pair1, _amount1);

        _compScore(_owner);
    }

    function deposit(uint256 _amount) public nonReentrant {
        _deferMine();

        require(_amount > 0, "Mine: params error");

        address _sender = _msgSender();

        DeferToken.transferFrom(_sender, address(this), _amount);

        // 更新最后提现时间
        addressLastWithdrawAt[_sender] = block.timestamp;

        addressDeposit[_sender] += _amount;
        depositTotal += _amount;

        _compScore(_sender);
    }

    function withdraw(uint256 _amount) public nonReentrant {
        _deferMine();

        address _sender = _msgSender();
        require(_amount > 0, "Mine: params error");
        require(
            block.timestamp >= withdrawLimit + addressLastWithdrawAt[_sender],
            "Mine: withdraw lock"
        );
        require(
            _amount <= addressDeposit[_sender],
            "Mine: insufficient balance"
        );

        addressDeposit[_sender] -= _amount;
        depositTotal -= _amount;

        DeferToken.transfer(_sender, _amount);

        _claim(_sender);
    }

    function claim() public nonReentrant {
        _deferMine();

        _claim(_msgSender());
    }

    function claimReward(address _address) public view returns (uint256) {
        return _claimReward(_address);
    }

    function _claim(address _sender) internal {
        if (addressScore[_sender] == 0) {
            return;
        }

        uint256 _reward = _claimReward(_sender);
        if (_reward == 0) {
            return;
        }

        // 个人交易额清零
        addressVolume[_sender] = 0;

        // 奖励池扣除
        deferTotal -= _reward;

        // 重置个人分数
        _compScore(_sender);

        // 将奖励打款到用户地址
        DeferToken.transfer(_sender, _reward);
    }

    function _claimReward(address _address) internal view returns (uint256) {
        if (scoreTotal == 0) {
            return 0;
        }
        return (deferTotal * addressScore[_address]) / scoreTotal;
    }

    function _deferMine() internal {
        if (lastBlock > block.number || lastBlock > endBlock) {
            return;
        }

        // 落后区块数量
        uint256 _num = block.number - lastBlock;
        // 更新最近结算区块
        lastBlock = block.number;
        // 更新奖金池
        deferTotal += perBlockDefer * _num * 1e18;
    }

    function _compScore(address _address) internal {
        uint256 _score = 0;

        uint256 _volume = addressVolume[_address] / 1e18;
        if (_volume > 0) {
            // 用户抵押
            uint256 _deposit = addressDeposit[_address] / 1e18;
            if (_deposit == 0) {
                _deposit = 1;
            }

            _score = _nthroot(_volume, 2) * _nthroot(_deposit, 2);
        }

        uint256 _oldScore = addressScore[_address];
        addressScore[_address] = _score;
        scoreTotal = scoreTotal + _score - _oldScore;
    }

    function _nthroot(uint256 _number, uint256 _root)
        internal
        pure
        returns (uint256)
    {
        if (_number == 1) {
            return 1;
        }

        uint256 a = _number;
        uint256 b = _number / _root;
        while (_diff(a, b) > 1) {
            a = b;
            b = ((_root - 1) * b + _number / b**(_root - 1)) / _root;
        }
        return b;
    }

    function _diff(uint256 _a, uint256 _b) internal pure returns (uint256) {
        if (_a >= _b) {
            return _a - _b;
        }
        return _b - _a;
    }
}
