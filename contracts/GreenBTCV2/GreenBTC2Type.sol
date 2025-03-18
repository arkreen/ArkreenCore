// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// x: MSB0:1; y: MSB1:1; w: MSB2:1; h: MSB3:1; boxTop:MSB4:4
// chance1: MSB8:2; chance10: MSB10:2; chance3: MSB12:2; chance4: MSB14:2
// ratio1: MSB16:2; ratio2: MSB18:2; ratio3: MSB20:2; ratio4: MSB22:2
// empty: MSB24:6; allchance: MSB30:2
struct Domain {
    uint8       x;          
    uint8       y;
    uint8       w;
    uint8       h;
    uint32      boxTop;
    uint16      chance1;
    uint16      chance2;
    uint16      chance3;
    uint16      chance4;
    uint16      ratio1;
    uint16      ratio2;
    uint16      ratio3;
    uint16      ratio4;
    uint48      empty;
    uint16      allchance;
}

// boxMadeGreen: MSB0:4; 
// won1: MSB8:3; won2: MSB11:3; won3: MSB14:3; won4: MSB17:3
// shot1: MSB20:3; shot2: MSB23:3; shot3: MSB26:3; shot4: MSB29:3

struct DomainStatus {
    uint24      boxMadeGreen;       // the progress of greenization, should be less than boxTop
    uint40      empty;
    uint24      won1;               // number of box winning type 1
    uint24      won2;               // number of box winning type 2
    uint24      won3;               // number of box winning type 3
    uint24      won4;               // number of box winning type 4
    uint24      shot1;              // number of box winning type 1
    uint24      shot2;
    uint24      shot3;
    uint24      shot4;
}

// blockHeight: MSB0:4; domainId: MSB4:2; boxStart: MSB6:4; boxAmount: MSB10: 4
// won1: MSB14:2; won2: MSB16:2; won3: MSB18:2; won4: MSB20:2
// shot1: MSB22:2; shot2: MSB24:2; shot3: MSB26:2; shot4: MSB28:2
// claimed: MSB30:2

struct action {
    uint32      blockHeight;        // block height of the action
    uint16      domainId;           // Id of the domain, msb flaging claimed or not
    uint24      boxStart;           // box position starting from 
    uint24      boxAmount;          // amount of box greenized 
    uint16      won1;               // number of box winning type 1, either the address of owner: MSB12-MSB31
    uint16      won2;
    uint16      won3;
    uint16      won4;
    uint16      shot1;              // number of box winning type 1
    uint16      shot2;
    uint16      shot3;
    uint16      shot4;
}