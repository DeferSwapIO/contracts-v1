// SPDX-License-Identifier: APACHE-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./AmountCompInterface.sol";

contract AmountComp is Ownable, AmountCompInterface {
    mapping(string => bool) stableToken;

    function setStableToken(string memory _name, bool _bool) public onlyOwner {
        stableToken[_name] = _bool;
    }

    function amount(string memory _pair1, uint256 _amount)
        external
        view
        override
        returns (uint256)
    {
        if (stableToken[_pair1]) {
            return _amount;
        }

        return 0;
    }
}
