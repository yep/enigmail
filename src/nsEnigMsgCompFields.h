/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License
 * Version 1.1 (the "MPL"); you may not use this file except in
 * compliance with the MPL. You may obtain a copy of the MPL at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the MPL is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the MPL
 * for the specific language governing rights and limitations under the
 * MPL.
 *
 * The Original Code is Enigmail.
 *
 * The Initial Developer of the Original Code is
 * Ramalingam Saravanan <sarava@sarava.net>
 * Portions created by the Initial Developer are Copyright (C) 2002
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or 
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

#ifndef _nsEnigMsgCompFields_h_
#define _nsEnigMsgCompFields_h_

#include "nsIMsgSMIMECompFields.h"
#include "nsIEnigMsgCompFields.h"
#include "nsCOMPtr.h"
#include "nsString.h"

class nsEnigMsgCompFields : public nsIEnigMsgCompFields,
                            public nsIMsgSMIMECompFields
                            
{
public:
    NS_DECL_ISUPPORTS
    NS_DECL_NSIENIGMSGCOMPFIELDS
    NS_FORWARD_SAFE_NSIMSGSMIMECOMPFIELDS(mMsgSMIMECompFields)


    nsEnigMsgCompFields();
    virtual ~nsEnigMsgCompFields();

    // Define a Create method to be used with a factory:
    static NS_METHOD
    Create(nsISupports *aOuter, REFNSIID aIID, void **aResult);

protected:
    PRUint32                        mUIFlags;
    PRUint32                        mSendFlags;

    nsCString                       mSenderEmailAddr;
    nsCString                       mRecipients;
    nsCString                       mHashAlgorithm;

    nsCOMPtr<nsIMsgSMIMECompFields> mMsgSMIMECompFields;
};

#endif