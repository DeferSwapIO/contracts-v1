// SPDX-License-Identifier: APACHE-2.0
pragma solidity ^0.8.0;

interface AmountCompInterface {
    function amount(string memory _pair1, uint256 _amount)
        external
        view
        returns (uint256);
}
