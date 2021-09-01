// SPDX-License-Identifier: APACHE-2.0
pragma solidity ^0.8.0;

interface NotifyInterface {
    function notify(
        string memory _pair1,
        uint256 _amount1,
        address _owner
    ) external;
}